import os
import uuid
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pedalboard.io import AudioFile

from lib import EFFECT_MAPPING, normalize_audio_for_display
from lib.effects import build_effect_chain

from .config import (
    AUDIO_INPUT_DIR,
    AUDIO_NORMALIZED_DIR,
    AUDIO_OUTPUT_DIR,
    IS_PRODUCTION,
    PRESIGNED_URL_EXPIRATION,
    S3_BUCKET,
    S3_INPUT_PREFIX,
    S3_OUTPUT_PREFIX,
    S3_REGION,
)
from .schemas import (
    ProcessRequest,
    ProcessResponse,
    S3ProcessRequest,
    S3ProcessResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)

router = APIRouter(prefix="/api")


@router.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "ok", "mode": "s3" if IS_PRODUCTION else "local"}


@router.get("/input-files")
async def list_input_files():
    """入力ファイル一覧を返却"""
    if not AUDIO_INPUT_DIR.exists():
        return {"files": []}
    files = sorted([f.name for f in AUDIO_INPUT_DIR.glob("*.wav")])
    return {"files": files}


@router.get("/effects")
async def get_available_effects():
    """利用可能なエフェクト一覧"""
    effects = []
    for name, config in EFFECT_MAPPING.items():
        effects.append(
            {
                "name": name,
                "default_params": config["params"],
                "class_name": config["class"].__name__,
            }
        )
    return {"effects": effects}


@router.post("/process", response_model=ProcessResponse)
async def process_audio(request: ProcessRequest):
    """音声処理API"""
    input_path = AUDIO_INPUT_DIR / request.input_file
    if not input_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Input file not found: {request.input_file}",
        )

    # 前回の出力ファイルを削除
    for old_file in AUDIO_OUTPUT_DIR.glob("*.wav"):
        old_file.unlink()
    if AUDIO_NORMALIZED_DIR.exists():
        for old_file in AUDIO_NORMALIZED_DIR.glob("*.wav"):
            old_file.unlink()

    # 出力ファイル名を生成
    output_filename = f"{uuid.uuid4().hex}.wav"
    output_path = AUDIO_OUTPUT_DIR / output_filename
    AUDIO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # エフェクトチェーンを構築・適用
    effect_chain = [{"name": e.name, "params": e.params or {}} for e in request.effect_chain]
    board = build_effect_chain(effect_chain)

    with AudioFile(str(input_path)) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate

    effected = board(audio, samplerate)

    with AudioFile(str(output_path), "w", samplerate, effected.shape[0]) as f:
        f.write(effected)

    # 表示用に正規化
    normalized_id = uuid.uuid4().hex
    input_norm_filename = f"input_{normalized_id}.wav"
    output_norm_filename = f"output_{normalized_id}.wav"

    normalize_audio_for_display(input_path, AUDIO_NORMALIZED_DIR / input_norm_filename)
    normalize_audio_for_display(output_path, AUDIO_NORMALIZED_DIR / output_norm_filename)

    return ProcessResponse(
        output_file=output_filename,
        download_url=f"/api/audio/{output_filename}",
        effects_applied=[e.name for e in request.effect_chain],
        input_normalized=input_norm_filename,
        output_normalized=output_norm_filename,
    )


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    """処理済み音声ファイルを返却"""
    file_path = AUDIO_OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path, media_type="audio/wav", filename=filename)


@router.get("/input-audio/{filename}")
async def get_input_audio(filename: str):
    """入力音声ファイルを返却"""
    file_path = AUDIO_INPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Input audio file not found")
    return FileResponse(file_path, media_type="audio/wav", filename=filename)


@router.get("/normalized/{filename}")
async def get_normalized_audio(filename: str):
    """表示用正規化音声ファイルを返却"""
    file_path = AUDIO_NORMALIZED_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Normalized audio file not found")
    return FileResponse(file_path, media_type="audio/wav", filename=filename)


# ============================================
# S3 Endpoints (for Lambda deployment)
# ============================================


def get_s3_client():
    """S3クライアントを取得"""
    return boto3.client(
        "s3",
        region_name=S3_REGION,
        endpoint_url=f"https://s3.{S3_REGION}.amazonaws.com",
        config=Config(signature_version="s3v4"),
    )


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(request: UploadUrlRequest):
    """S3へのアップロード用Presigned URLを生成"""
    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    # ユニークなキーを生成
    file_id = uuid.uuid4().hex
    extension = request.filename.split(".")[-1] if "." in request.filename else "wav"
    s3_key = f"{S3_INPUT_PREFIX}{file_id}.{extension}"

    try:
        s3 = get_s3_client()
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": s3_key,
                "ContentType": request.content_type,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRATION,
        )
        return UploadUrlResponse(upload_url=upload_url, s3_key=s3_key)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {e}")


@router.post("/s3-process", response_model=S3ProcessResponse)
async def process_s3_audio(request: S3ProcessRequest):
    """S3上の音声ファイルを処理"""
    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    s3 = get_s3_client()
    input_key = request.s3_key

    # 入力ファイルをダウンロード
    input_path = f"/tmp/input_{uuid.uuid4().hex}.wav"
    try:
        s3.download_file(S3_BUCKET, input_key, input_path)
    except ClientError as e:
        raise HTTPException(status_code=404, detail=f"Input file not found in S3: {e}")

    # エフェクトチェーンを構築・適用
    effect_chain = [{"name": e.name, "params": e.params or {}} for e in request.effect_chain]
    board = build_effect_chain(effect_chain)

    with AudioFile(input_path) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate

    effected = board(audio, samplerate)

    # 出力ファイルを書き込み
    output_id = uuid.uuid4().hex
    output_path = f"/tmp/output_{output_id}.wav"
    with AudioFile(output_path, "w", samplerate, effected.shape[0]) as f:
        f.write(effected)

    # 表示用に正規化
    normalized_id = uuid.uuid4().hex
    input_norm_path = Path(f"/tmp/input_norm_{normalized_id}.wav")
    output_norm_path = Path(f"/tmp/output_norm_{normalized_id}.wav")
    normalize_audio_for_display(Path(input_path), input_norm_path)
    normalize_audio_for_display(Path(output_path), output_norm_path)

    # S3にアップロード（出力 + 正規化ファイル）
    output_key = f"{S3_OUTPUT_PREFIX}{output_id}.wav"
    input_norm_key = f"{S3_OUTPUT_PREFIX}normalized/input_{normalized_id}.wav"
    output_norm_key = f"{S3_OUTPUT_PREFIX}normalized/output_{normalized_id}.wav"

    try:
        extra_args = {"ContentType": "audio/wav"}
        s3.upload_file(output_path, S3_BUCKET, output_key, ExtraArgs=extra_args)
        s3.upload_file(str(input_norm_path), S3_BUCKET, input_norm_key, ExtraArgs=extra_args)
        s3.upload_file(str(output_norm_path), S3_BUCKET, output_norm_key, ExtraArgs=extra_args)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload output to S3: {e}")

    # ダウンロード用Presigned URLを生成
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": output_key},
        ExpiresIn=PRESIGNED_URL_EXPIRATION,
    )
    input_norm_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": input_norm_key},
        ExpiresIn=PRESIGNED_URL_EXPIRATION,
    )
    output_norm_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": output_norm_key},
        ExpiresIn=PRESIGNED_URL_EXPIRATION,
    )

    # 一時ファイルを削除
    os.remove(input_path)
    os.remove(output_path)
    os.remove(input_norm_path)
    os.remove(output_norm_path)

    return S3ProcessResponse(
        output_key=output_key,
        download_url=download_url,
        effects_applied=[e.name for e in request.effect_chain],
        input_normalized_url=input_norm_url,
        output_normalized_url=output_norm_url,
    )


@router.get("/download-url/{s3_key:path}")
async def get_download_url(s3_key: str):
    """S3からのダウンロード用Presigned URLを生成"""
    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 bucket not configured")

    try:
        s3 = get_s3_client()
        download_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=PRESIGNED_URL_EXPIRATION,
        )
        return {"download_url": download_url}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {e}")
