import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pedalboard.io import AudioFile

from lib import EFFECT_MAPPING, normalize_audio_for_display
from lib.effects import build_effect_chain

from .config import AUDIO_INPUT_DIR, AUDIO_NORMALIZED_DIR, AUDIO_OUTPUT_DIR
from .schemas import ProcessRequest, ProcessResponse

router = APIRouter(prefix="/api")


@router.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "ok"}


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
