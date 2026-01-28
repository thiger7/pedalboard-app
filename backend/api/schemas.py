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
