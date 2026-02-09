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
    original_filename: str | None = None


class S3ProcessResponse(BaseModel):
    """S3音声処理レスポンス（同期処理用 - 後方互換）"""

    output_key: str
    download_url: str
    effects_applied: list[str]
    input_normalized_url: str
    output_normalized_url: str


class S3ProcessAsyncResponse(BaseModel):
    """S3音声処理レスポンス（非同期処理用）"""

    job_id: str
    status: str


# Job management schemas
class JobResponse(BaseModel):
    """ジョブ情報レスポンス"""

    job_id: str
    status: str
    effect_chain: list[EffectConfig]
    original_filename: str | None = None
    created_at: str
    updated_at: str
    completed_at: str | None = None
    error_message: str | None = None
    download_url: str | None = None
    input_normalized_url: str | None = None
    output_normalized_url: str | None = None


class BatchJobsRequest(BaseModel):
    """複数ジョブ取得リクエスト"""

    job_ids: list[str]


class BatchJobsResponse(BaseModel):
    """複数ジョブ取得レスポンス"""

    jobs: list[JobResponse]
