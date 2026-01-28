#!/usr/bin/env python3
"""
入力と出力の波形を比較するスクリプト
"""
import numpy as np
import matplotlib.pyplot as plt
from pedalboard.io import AudioFile
import sys

def compare_waveforms(input_path, output_path):
    """
    入力と出力の波形を比較表示
    """
    print(f"入力ファイル: {input_path}")
    print(f"出力ファイル: {output_path}")
    
    # 入力ファイルを読み込み
    with AudioFile(input_path) as f:
        input_audio = f.read(f.frames)
        samplerate = f.samplerate
    
    # 出力ファイルを読み込み
    with AudioFile(output_path) as f:
        output_audio = f.read(f.frames)
    
    # ステレオの場合は左チャンネルのみ使用
    if input_audio.shape[0] > 1:
        input_audio = input_audio[0]
    else:
        input_audio = input_audio[0]
    
    if output_audio.shape[0] > 1:
        output_audio = output_audio[0]
    else:
        output_audio = output_audio[0]
    
    # 時間軸を作成
    time = np.arange(len(input_audio)) / samplerate
    
    # 表示する範囲を制限（最初の3秒間）
    display_seconds = 3.0
    max_samples = int(display_seconds * samplerate)
    time = time[:max_samples]
    input_audio = input_audio[:max_samples]
    output_audio = output_audio[:max_samples]
    
    # グラフを作成
    fig, axes = plt.subplots(3, 1, figsize=(14, 10))
    
    # 入力波形
    axes[0].plot(time, input_audio, linewidth=0.5, color='blue')
    axes[0].set_title('入力波形 (Original)', fontsize=14, fontweight='bold')
    axes[0].set_ylabel('振幅')
    axes[0].grid(True, alpha=0.3)
    axes[0].set_xlim(0, display_seconds)
    
    # 出力波形
    axes[1].plot(time, output_audio, linewidth=0.5, color='red')
    axes[1].set_title('出力波形 (Processed)', fontsize=14, fontweight='bold')
    axes[1].set_ylabel('振幅')
    axes[1].grid(True, alpha=0.3)
    axes[1].set_xlim(0, display_seconds)
    
    # 重ね合わせ
    axes[2].plot(time, input_audio, linewidth=0.5, color='blue', alpha=0.7, label='入力')
    axes[2].plot(time, output_audio, linewidth=0.5, color='red', alpha=0.7, label='出力')
    axes[2].set_title('重ね合わせ比較', fontsize=14, fontweight='bold')
    axes[2].set_xlabel('時間 (秒)')
    axes[2].set_ylabel('振幅')
    axes[2].legend()
    axes[2].grid(True, alpha=0.3)
    axes[2].set_xlim(0, display_seconds)
    
    plt.tight_layout()
    
    # 保存
    output_image = 'audio/output/waveform_comparison.png'
    plt.savefig(output_image, dpi=150, bbox_inches='tight')
    print(f"\n波形比較画像を保存しました: {output_image}")
    
    # 表示
    plt.show()
    
    # 統計情報を表示
    print("\n=== 統計情報 ===")
    print(f"入力 - 最大振幅: {np.max(np.abs(input_audio)):.4f}")
    print(f"出力 - 最大振幅: {np.max(np.abs(output_audio)):.4f}")
    print(f"入力 - RMS: {np.sqrt(np.mean(input_audio**2)):.4f}")
    print(f"出力 - RMS: {np.sqrt(np.mean(output_audio**2)):.4f}")

if __name__ == "__main__":
    # コマンドライン引数で指定可能
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
    else:
        # デフォルトのファイル
        input_file = "audio/input/guitar1.wav"
        output_file = "audio/output/guitar1_processed.wav"
    
    compare_waveforms(input_file, output_file)
