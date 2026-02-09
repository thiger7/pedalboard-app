import os
from pathlib import Path

AUDIO_INPUT_DIR = Path(os.environ.get("AUDIO_INPUT_DIR", "/app/audio/input"))
AUDIO_OUTPUT_DIR = Path(os.environ.get("AUDIO_OUTPUT_DIR", "/app/audio/output"))
AUDIO_NORMALIZED_DIR = AUDIO_OUTPUT_DIR / "normalized"

# S3 settings (for Lambda deployment)
S3_BUCKET = os.environ.get("AUDIO_BUCKET", "")
S3_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
S3_INPUT_PREFIX = "input/"
S3_OUTPUT_PREFIX = "output/"
PRESIGNED_URL_EXPIRATION = 3600  # 1 hour

# Environment: "production" uses S3, "development" uses local files
ENV = os.environ.get("ENV", "development")
IS_PRODUCTION = ENV == "production"

# SQS settings (for async processing)
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")
ASYNC_PROCESSING_ENABLED = bool(SQS_QUEUE_URL)

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",  # CloudFront
]
