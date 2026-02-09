"""
SQS Worker Lambda Handler

SQSからメッセージを受信し、音声処理を実行するワーカーLambda。
処理完了後、DynamoDBのジョブステータスを更新する。
"""

import os
import uuid
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from pedalboard.io import AudioFile

from lib import normalize_audio_for_display
from lib.effects import build_effect_chain
from lib.job_service import mark_job_completed, mark_job_failed, mark_job_processing
from lib.sqs import parse_sqs_message

S3_BUCKET = os.environ.get("AUDIO_BUCKET", "")
S3_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
S3_OUTPUT_PREFIX = "output/"


def get_s3_client():
    """S3クライアントを取得"""
    return boto3.client(
        "s3",
        region_name=S3_REGION,
        endpoint_url=f"https://s3.{S3_REGION}.amazonaws.com",
        config=Config(signature_version="s3v4"),
    )


def process_audio_file(input_key: str, effect_chain: list[dict]) -> tuple[str, str, str]:
    """
    S3上の音声ファイルを処理

    Returns:
        tuple: (output_key, input_norm_key, output_norm_key)
    """
    s3 = get_s3_client()

    # 入力ファイルをダウンロード
    input_path = f"/tmp/input_{uuid.uuid4().hex}.wav"
    s3.download_file(S3_BUCKET, input_key, input_path)

    # エフェクトチェーンを構築・適用
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
    input_norm_path = Path(f"/tmp/input_norm_{output_id}.wav")
    output_norm_path = Path(f"/tmp/output_norm_{output_id}.wav")
    normalize_audio_for_display(Path(input_path), input_norm_path)
    normalize_audio_for_display(Path(output_path), output_norm_path)

    # S3にアップロード
    output_key = f"{S3_OUTPUT_PREFIX}{output_id}.wav"
    input_norm_key = f"{S3_OUTPUT_PREFIX}normalized/input_{output_id}.wav"
    output_norm_key = f"{S3_OUTPUT_PREFIX}normalized/output_{output_id}.wav"

    extra_args = {"ContentType": "audio/wav"}
    s3.upload_file(output_path, S3_BUCKET, output_key, ExtraArgs=extra_args)
    s3.upload_file(str(input_norm_path), S3_BUCKET, input_norm_key, ExtraArgs=extra_args)
    s3.upload_file(str(output_norm_path), S3_BUCKET, output_norm_key, ExtraArgs=extra_args)

    # 一時ファイルを削除
    os.remove(input_path)
    os.remove(output_path)
    os.remove(input_norm_path)
    os.remove(output_norm_path)

    return output_key, input_norm_key, output_norm_key


def handler(event, context):
    """Lambda handler for SQS messages"""
    results = []

    for record in event.get("Records", []):
        try:
            message = parse_sqs_message(record)
            job_id = message.get("job_id")
            input_key = message.get("input_key")
            effect_chain = message.get("effect_chain", [])

            if not job_id or not input_key:
                results.append({"status": "error", "error": "Missing job_id or input_key"})
                continue

            # ステータスを処理中に更新
            mark_job_processing(job_id)

            # 音声処理を実行
            output_key, _, _ = process_audio_file(input_key, effect_chain)

            # ステータスを完了に更新
            mark_job_completed(job_id, output_key)

            results.append({"status": "success", "job_id": job_id, "output_key": output_key})

        except ClientError as e:
            error_message = f"S3 error: {e}"
            if job_id:
                mark_job_failed(job_id, error_message)
            results.append({"status": "error", "job_id": job_id, "error": error_message})

        except Exception as e:
            error_message = str(e)
            if job_id:
                mark_job_failed(job_id, error_message)
            results.append({"status": "error", "job_id": job_id, "error": error_message})

    return {"batchItemFailures": []}
