#!/usr/bin/env python3
"""
ローカルでPedalboard処理をテストするスクリプト
"""
import os
from pedalboard import Pedalboard, Chorus, Reverb, Gain, Compressor, Distortion
from pedalboard.io import AudioFile

def process_audio(input_path, output_path):
    """
    音声ファイルにエフェクトを適用
    """
    print(f"入力: {input_path}")
    print(f"出力: {output_path}")
    
    # エフェクトチェーンの作成
    board = Pedalboard([
        Gain(gain_db=3.0),              # 音量を上げる
        Compressor(threshold_db=-20, ratio=4),  # コンプレッサー
        Distortion(drive_db=10),         # ディストーション
        Chorus(rate_hz=1.0, depth=0.25), # コーラス
        Reverb(room_size=0.25)           # リバーブ
    ])
    
    print("\nエフェクトチェーン:")
    for i, effect in enumerate(board, 1):
        print(f"  {i}. {effect}")
    
    # 音声ファイルの読み込みと処理
    print("\n音声ファイルを読み込み中...")
    with AudioFile(input_path) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate
        print(f"  サンプルレート: {samplerate} Hz")
        print(f"  チャンネル数: {audio.shape[0]}")
        print(f"  フレーム数: {audio.shape[1]}")
        print(f"  長さ: {audio.shape[1] / samplerate:.2f} 秒")
    
    # エフェクトを適用
    print("\nエフェクトを適用中...")
    effected = board(audio, samplerate)
    
    # 出力ファイルに保存
    print(f"\n出力ファイルに保存中: {output_path}")
    with AudioFile(output_path, 'w', samplerate, effected.shape[0]) as f:
        f.write(effected)
    
    print("\n✅ 処理完了!")
    return output_path

if __name__ == "__main__":
    # 入力ファイルのパス
    input_file = "audio/input/名称未設定 - 2026:01:19 22.22.wav"
    
    # 出力ファイルのパス
    output_file = "audio/output/guitar1_processed.wav"
    
    # 出力ディレクトリが存在しない場合は作成
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # 処理実行
    process_audio(input_file, output_file)
