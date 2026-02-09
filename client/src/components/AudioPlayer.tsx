import WavesurferPlayer from '@wavesurfer/react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type WaveSurfer from 'wavesurfer.js';

export interface AudioPlayerHandle {
  pause: () => void;
}

interface AudioPlayerProps {
  label: string;
  audioUrl: string | null;
  color?: string;
  onPlay?: () => void;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ label, audioUrl, color = '#3b82f6', onPlay }, ref) {
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // 外部から pause を呼べるようにする
    useImperativeHandle(ref, () => ({
      pause: () => wavesurferRef.current?.pause(),
    }));

    const handleReady = useCallback((ws: WaveSurfer) => {
      wavesurferRef.current = ws;
      setIsReady(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(ws.getDuration());
    }, []);

    const handlePlay = useCallback(() => {
      setIsPlaying(true);
      onPlay?.();
    }, [onPlay]);

    const handlePause = useCallback(() => {
      setIsPlaying(false);
    }, []);

    const handleFinish = useCallback(() => {
      setIsPlaying(false);
    }, []);

    const handleTimeupdate = useCallback((ws: WaveSurfer) => {
      setCurrentTime(ws.getCurrentTime());
    }, []);

    const togglePlay = useCallback(() => {
      wavesurferRef.current?.playPause();
    }, []);

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
        <div className="audio-player-waveform">
          <WavesurferPlayer
            url={audioUrl}
            waveColor={color}
            progressColor={`${color}80`}
            cursorColor="#ef4444"
            height={150}
            barWidth={2}
            barGap={1}
            barRadius={2}
            normalize={true}
            onReady={handleReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onFinish={handleFinish}
            onTimeupdate={handleTimeupdate}
          />
        </div>
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
  },
);
