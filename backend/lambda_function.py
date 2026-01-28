import json

import boto3
from pedalboard.io import AudioFile

from lib import build_effect_chain, get_default_effect_chain


def handler(event, context):
    """
    Lambda handler for audio processing with Pedalboard

    Expected event format:
    {
        "input_path": "/path/to/input.wav",
        "output_path": "/tmp/output.wav",
        "effect_chain": [
            {"name": "Blues Driver", "params": {"drive_db": 15}},
            {"name": "Chorus"},
            {"name": "Reverb", "params": {"room_size": 0.7}}
        ],
        "s3_bucket": "optional-bucket-name",
        "s3_key": "optional/output/key.wav"
    }
    """
    try:
        input_path = event.get("input_path")
        output_path = event.get("output_path", "/tmp/output.wav")
        effect_chain = event.get("effect_chain", [])

        if not input_path:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "input_path is required"}),
            }

        # エフェクトチェーンを構築
        if effect_chain:
            board = build_effect_chain(effect_chain)
        else:
            board = get_default_effect_chain()

        # 音声ファイルの読み込みと処理
        with AudioFile(input_path) as f:
            audio = f.read(f.frames)
            samplerate = f.samplerate

        effected = board(audio, samplerate)

        with AudioFile(output_path, "w", samplerate, effected.shape[0]) as f:
            f.write(effected)

        # S3にアップロード（オプション）
        if event.get("s3_bucket"):
            s3 = boto3.client("s3")
            s3_key = event.get("s3_key", "output/processed.wav")
            s3.upload_file(output_path, event["s3_bucket"], s3_key)

            return {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "message": "Audio processed successfully",
                        "s3_location": f"s3://{event['s3_bucket']}/{s3_key}",
                        "effects_applied": (
                            [e.get("name") for e in effect_chain] if effect_chain else ["default"]
                        ),
                    }
                ),
            }

        applied = [e.get("name") for e in effect_chain] if effect_chain else ["default"]
        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Audio processed successfully",
                    "output_path": output_path,
                    "effects_applied": applied,
                }
            ),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
