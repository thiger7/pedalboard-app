import os
import sys
import uuid
from pathlib import Path
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pedalboard.io import AudioFile
from pydantic import BaseModel

# lambda_function.pyをインポートするためにパスを追加
sys.path.insert(0, str(Path(__file__).parent.parent))
from lambda_function import EFFECT_MAPPING, handler

# 表示用に正規化された音声を保存するディレクトリ
AUDIO_NORMALIZED_DIR = Path(os.environ.get("AUDIO_OUTPUT_DIR", "/app/audio/output")) / "normalized"

app = FastAPI(
    title="Pedalboard API",
    description="ギターエフェクト処理API",
    version="1.0.0"
)

# CORS設定（React開発サーバーからのアクセス許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# パス設定（Docker環境用）
AUDIO_INPUT_DIR = Path(os.environ.get("AUDIO_INPUT_DIR", "/app/audio/input"))
AUDIO_OUTPUT_DIR = Path(os.environ.get("AUDIO_OUTPUT_DIR", "/app/audio/output"))


class EffectConfig(BaseModel):
    """エフェクト設定"""
    name: str
    params: Optional[dict] = None


class ProcessRequest(BaseModel):
    """音声処理リクエスト"""
    input_file: str
    effect_chain: List[EffectConfig]


class ProcessResponse(BaseModel):
    """音声処理レスポンス"""
    output_file: str
    download_url: str
    effects_applied: List[str]
    input_normalized: str  # 表示用正規化入力
    output_normalized: str  # 表示用正規化出力


def normalize_audio_for_display(input_path: Path, output_path: Path, target_peak: float = 0.7):
    """表示用に音声を正規化"""
    with AudioFile(str(input_path)) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio * (target_peak / peak)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with AudioFile(str(output_path), 'w', samplerate, audio.shape[0]) as f:
        f.write(audio)


@app.get("/api/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "ok"}


@app.get("/api/input-files")
async def list_input_files():
    """入力ファイル一覧を返却"""
    if not AUDIO_INPUT_DIR.exists():
        return {"files": []}

    files = sorted([f.name for f in AUDIO_INPUT_DIR.glob("*.wav")])
    return {"files": files}


@app.get("/api/effects")
async def get_available_effects():
    """利用可能なエフェクト一覧"""
    effects = []
    for name, config in EFFECT_MAPPING.items():
        effects.append({
            "name": name,
            "default_params": config["params"],
            "class_name": config["class"].__name__
        })
    return {"effects": effects}


@app.post("/api/process", response_model=ProcessResponse)
async def process_audio(request: ProcessRequest):
    """
    音声処理API

    Request:
    {
        "input_file": "guitar1.wav",
        "effect_chain": [
            {"name": "Blues Driver", "params": {"drive_db": 15}},
            {"name": "Chorus"}
        ]
    }
    """
    input_path = AUDIO_INPUT_DIR / request.input_file
    if not input_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Input file not found: {request.input_file}"
        )

    # 前回の出力ファイルを削除（outputとnormalized両方）
    for old_file in AUDIO_OUTPUT_DIR.glob("*.wav"):
        old_file.unlink()
    if AUDIO_NORMALIZED_DIR.exists():
        for old_file in AUDIO_NORMALIZED_DIR.glob("*.wav"):
            old_file.unlink()

    # 出力ファイル名を生成
    output_filename = f"{uuid.uuid4().hex}.wav"
    output_path = AUDIO_OUTPUT_DIR / output_filename

    # 出力ディレクトリを作成
    AUDIO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # effect_chainをdict形式に変換
    effect_chain = [
        {"name": e.name, "params": e.params or {}}
        for e in request.effect_chain
    ]

    # lambda_function.handlerを呼び出し
    result = handler({
        "input_path": str(input_path),
        "output_path": str(output_path),
        "effect_chain": effect_chain,
    }, None)

    if result["statusCode"] != 200:
        import json
        body = result["body"]
        error_body = json.loads(body) if isinstance(body, str) else body
        raise HTTPException(
            status_code=result["statusCode"],
            detail=error_body.get("error", "Unknown error")
        )

    # 表示用に入力と出力を同じピークレベルに正規化
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


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """処理済み音声ファイルを返却"""
    file_path = AUDIO_OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(
        file_path,
        media_type="audio/wav",
        filename=filename
    )


@app.get("/api/input-audio/{filename}")
async def get_input_audio(filename: str):
    """入力音声ファイルを返却（再生用）"""
    file_path = AUDIO_INPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Input audio file not found")
    return FileResponse(
        file_path,
        media_type="audio/wav",
        filename=filename
    )


@app.get("/api/normalized/{filename}")
async def get_normalized_audio(filename: str):
    """表示用正規化音声ファイルを返却"""
    file_path = AUDIO_NORMALIZED_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Normalized audio file not found")
    return FileResponse(
        file_path,
        media_type="audio/wav",
        filename=filename
    )
