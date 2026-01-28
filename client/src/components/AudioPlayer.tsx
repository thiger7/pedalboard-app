import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface AudioPlayerProps {
  label: string;
  audioUrl: string | null;
  color?: string;
}

export function AudioPlayer({
  label,
  audioUrl,
  color = '#3b82f6',
}: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    // 既存のインスタンスを破棄
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    setIsReady(false);
    setIsPlaying(false);

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor: color.replace(')', ', 0.5)').replace('rgb', 'rgba'),
      cursorColor: '#ef4444',
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true, // wavesurfer側で正規化（バックエンドで同じピークに揃えているので縮尺は同じ）
    });

    wavesurfer.load(audioUrl);

    wavesurfer.on('ready', () => {
      setIsReady(true);
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => setIsPlaying(false));
    wavesurfer.on('timeupdate', (time) => setCurrentTime(time));

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, color]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return (
      <div className="audio-player">
        <div className="audio-player-header">
          <span className="audio-player-label">{label}</span>
        </div>
        <div className="audio-player-placeholder">No audio loaded</div>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <div className="audio-player-header">
        <span className="audio-player-label">{label}</span>
        <span className="audio-player-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <div ref={containerRef} className="audio-player-waveform" />
      <div className="audio-player-controls">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isReady}
          className="play-button"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>
    </div>
  );
}
