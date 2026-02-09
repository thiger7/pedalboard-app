import json
import os

import boto3
from botocore.exceptions import ClientError

SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")


def get_sqs_client():
    """SQS クライアントを取得"""
    return boto3.client("sqs", region_name=AWS_REGION)


def send_job_message(
    job_id: str,
    input_key: str,
    effect_chain: list[dict],
    original_filename: str | None = None,
) -> bool:
    """ジョブメッセージをSQSに送信"""
    if not SQS_QUEUE_URL:
        raise RuntimeError("SQS_QUEUE_URL is not configured")

    message_body = {
        "job_id": job_id,
        "input_key": input_key,
        "effect_chain": effect_chain,
        "original_filename": original_filename,
    }

    sqs = get_sqs_client()
    try:
        params = {
            "QueueUrl": SQS_QUEUE_URL,
            "MessageBody": json.dumps(message_body),
        }
        # FIFOキューの場合のみMessageGroupIdを追加
        if ".fifo" in SQS_QUEUE_URL:
            params["MessageGroupId"] = job_id
        sqs.send_message(**params)
        return True
    except ClientError:
        return False


def parse_sqs_message(record: dict) -> dict:
    """SQSレコードからメッセージを解析"""
    body = record.get("body", "{}")
    return json.loads(body)
