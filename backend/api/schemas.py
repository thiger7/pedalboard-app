from pydantic import BaseModel


class EffectConfig(BaseModel):
    """エフェクト設定"""

    name: str
    params: dict | None = None


class ProcessRequest(BaseModel):
    """音声処理リクエスト"""

    input_file: str
    effect_chain: list[EffectConfig]


class ProcessResponse(BaseModel):
    """音声処理レスポンス"""

    output_file: str
    download_url: str
    effects_applied: list[str]
    input_normalized: str
    output_normalized: str


# S3 Upload schemas
class UploadUrlRequest(BaseModel):
    """アップロードURL生成リクエスト"""

    filename: str
    content_type: str = "audio/wav"


class UploadUrlResponse(BaseModel):
    """アップロードURL生成レスポンス"""

    upload_url: str
    s3_key: str


class S3ProcessRequest(BaseModel):
    """S3音声処理リクエスト"""

    s3_key: str
    effect_chain: list[EffectConfig]


class S3ProcessResponse(BaseModel):
    """S3音声処理レスポンス"""

    output_key: str
    download_url: str
    effects_applied: list[str]
    input_normalized_url: str
    output_normalized_url: str
