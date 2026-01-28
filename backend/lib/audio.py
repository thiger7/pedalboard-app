from pathlib import Path

import numpy as np
from pedalboard.io import AudioFile


def normalize_audio_for_display(
    input_path: Path,
    output_path: Path,
    target_peak: float = 0.7,
) -> None:
    """表示用に音声を正規化"""
    with AudioFile(str(input_path)) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio * (target_peak / peak)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with AudioFile(str(output_path), "w", samplerate, audio.shape[0]) as f:
        f.write(audio)
