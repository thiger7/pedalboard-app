import os
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any

from .dynamodb import batch_get_items, get_item, put_item


def _convert_floats_to_decimal(obj: Any) -> Any:
    """float値をDecimalに変換（DynamoDB用）"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats_to_decimal(item) for item in obj]
    return obj

JOB_TTL_DAYS = int(os.environ.get("JOB_TTL_DAYS", "7"))


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def generate_job_id() -> str:
    """ジョブIDを生成"""
    return uuid.uuid4().hex


def _make_pk(job_id: str) -> str:
    return f"JOB#{job_id}"


def _make_gsi1pk(status: JobStatus) -> str:
    return f"STATUS#{status.value}"


def _calculate_ttl() -> int:
    """TTL（expires_at）を計算"""
    expire_time = datetime.now(UTC) + timedelta(days=JOB_TTL_DAYS)
    return int(expire_time.timestamp())


def create_job(
    input_key: str,
    effect_chain: list[dict],
    original_filename: str | None = None,
) -> dict:
    """ジョブを作成"""
    job_id = generate_job_id()
    now = datetime.now(UTC).isoformat()

    # DynamoDB用にfloat値をDecimalに変換
    effect_chain_for_db = _convert_floats_to_decimal(effect_chain)

    item = {
        "PK": _make_pk(job_id),
        "SK": "META",
        "job_id": job_id,
        "status": JobStatus.PENDING.value,
        "input_key": input_key,
        "output_key": None,
        "effect_chain": effect_chain_for_db,
        "original_filename": original_filename,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        "error_message": None,
        "GSI1PK": _make_gsi1pk(JobStatus.PENDING),
        "GSI1SK": now,
        "expires_at": _calculate_ttl(),
    }

    if put_item(item):
        return item
    raise RuntimeError("Failed to create job")


def get_job(job_id: str) -> dict | None:
    """ジョブを取得"""
    return get_item(_make_pk(job_id), "META")


def get_jobs_batch(job_ids: list[str]) -> list[dict]:
    """複数ジョブを一括取得"""
    if not job_ids:
        return []

    keys = [{"PK": _make_pk(job_id), "SK": "META"} for job_id in job_ids]
    return batch_get_items(keys)


def update_job_status(
    job_id: str,
    status: JobStatus,
    output_key: str | None = None,
    error_message: str | None = None,
) -> bool:
    """ジョブのステータスを更新"""
    now = datetime.now(UTC).isoformat()

    update_parts = [
        "#status = :status",
        "updated_at = :updated_at",
        "GSI1PK = :gsi1pk",
    ]
    expression_values = {
        ":status": status.value,
        ":updated_at": now,
        ":gsi1pk": _make_gsi1pk(status),
    }

    if status == JobStatus.COMPLETED:
        update_parts.append("completed_at = :completed_at")
        expression_values[":completed_at"] = now

    if output_key is not None:
        update_parts.append("output_key = :output_key")
        expression_values[":output_key"] = output_key

    if error_message is not None:
        update_parts.append("error_message = :error_message")
        expression_values[":error_message"] = error_message

    update_expression = "SET " + ", ".join(update_parts)

    from .dynamodb import get_table

    table = get_table()
    try:
        table.update_item(
            Key={"PK": _make_pk(job_id), "SK": "META"},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ExpressionAttributeNames={"#status": "status"},
        )
        return True
    except Exception:
        return False


def mark_job_processing(job_id: str) -> bool:
    """ジョブを処理中に更新"""
    return update_job_status(job_id, JobStatus.PROCESSING)


def mark_job_completed(job_id: str, output_key: str) -> bool:
    """ジョブを完了に更新"""
    return update_job_status(job_id, JobStatus.COMPLETED, output_key=output_key)


def mark_job_failed(job_id: str, error_message: str) -> bool:
    """ジョブを失敗に更新"""
    return update_job_status(job_id, JobStatus.FAILED, error_message=error_message)
