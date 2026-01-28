import json
import os
from pedalboard import Pedalboard, Chorus, Reverb, Gain, Compressor, Distortion, Delay
from pedalboard.io import AudioFile
import boto3

# エフェクトマッピング（画像名 → pedalboardクラス + デフォルトパラメータ）
# BOSS実機の音響特性に準拠
EFFECT_MAPPING = {
    # 歪み系（弱→強の順）
    "Booster_Preamp": {"class": Gain, "params": {"gain_db": 6}},
    "Blues Driver": {"class": Distortion, "params": {"drive_db": 10}},
    "SUPER OverDrive": {"class": Distortion, "params": {"drive_db": 15}},
    "Distortion": {"class": Distortion, "params": {"drive_db": 30}},
    "Fuzz": {"class": Distortion, "params": {"drive_db": 33}},
    "Metal Zone": {"class": Distortion, "params": {"drive_db": 36}},
    "Heavy Metal": {"class": Distortion, "params": {"drive_db": 50}},
    # モジュレーション系
    "Chorus": {"class": Chorus, "params": {"rate_hz": 1.0, "depth": 0.25}},
    "Dimension": {"class": Chorus, "params": {"rate_hz": 0.5, "depth": 0.15}},
    "Vibrato": {"class": Chorus, "params": {"rate_hz": 0.3, "depth": 0.5, "mix": 1.0}},
    # 空間系
    "Delay": {"class": Delay, "params": {"delay_seconds": 0.35, "feedback": 0.4}},
    "Reverb": {"class": Reverb, "params": {"room_size": 0.5}},
}


def build_effect_chain(effect_list: list) -> Pedalboard:
    """
    エフェクトリストからPedalboardを構築

    Args:
        effect_list: [{"name": "Blues Driver", "params": {"drive_db": 20}}, ...]

    Returns:
        Pedalboard: 構築されたエフェクトチェーン
    """
    effects = []
    for effect_config in effect_list:
        effect_name = effect_config.get("name")
        custom_params = effect_config.get("params", {})

        if effect_name not in EFFECT_MAPPING:
            continue

        mapping = EFFECT_MAPPING[effect_name]
        effect_class = mapping["class"]
        # デフォルトパラメータをカスタムパラメータで上書き
        params = {**mapping["params"], **custom_params}

        effects.append(effect_class(**params))

    return Pedalboard(effects)


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
        # イベントからパラメータを取得
        input_path = event.get('input_path')
        output_path = event.get('output_path', '/tmp/output.wav')
        effect_chain = event.get('effect_chain', [])

        if not input_path:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'input_path is required'})
            }

        # エフェクトチェーンを構築
        if effect_chain:
            board = build_effect_chain(effect_chain)
        else:
            # デフォルトチェーン（後方互換）
            board = Pedalboard([
                Gain(gain_db=3.0),
                Compressor(threshold_db=-20, ratio=4),
                Distortion(drive_db=10),
                Chorus(rate_hz=1.0, depth=0.25),
                Reverb(room_size=0.25)
            ])

        # 音声ファイルの読み込みと処理
        with AudioFile(input_path) as f:
            audio = f.read(f.frames)
            samplerate = f.samplerate

        # エフェクトを適用
        effected = board(audio, samplerate)

        # 出力ファイルに保存
        with AudioFile(output_path, 'w', samplerate, effected.shape[0]) as f:
            f.write(effected)

        # S3にアップロード（オプション）
        if event.get('s3_bucket'):
            s3 = boto3.client('s3')
            s3_key = event.get('s3_key', 'output/processed.wav')
            s3.upload_file(output_path, event['s3_bucket'], s3_key)

            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Audio processed successfully',
                    's3_location': f"s3://{event['s3_bucket']}/{s3_key}",
                    'effects_applied': [e.get('name') for e in effect_chain] if effect_chain else ['default']
                })
            }

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Audio processed successfully',
                'output_path': output_path,
                'effects_applied': [e.get('name') for e in effect_chain] if effect_chain else ['default']
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
