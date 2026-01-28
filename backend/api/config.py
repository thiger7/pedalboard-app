import os
from pathlib import Path

AUDIO_INPUT_DIR = Path(os.environ.get("AUDIO_INPUT_DIR", "/app/audio/input"))
AUDIO_OUTPUT_DIR = Path(os.environ.get("AUDIO_OUTPUT_DIR", "/app/audio/output"))
AUDIO_NORMALIZED_DIR = AUDIO_OUTPUT_DIR / "normalized"

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
