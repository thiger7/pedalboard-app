import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer, type AudioPlayerHandle } from './AudioPlayer';

// wavesurfer のモックインスタンス
const mockWavesurfer = {
  playPause: vi.fn(),
  pause: vi.fn(),
  getDuration: vi.fn(() => 120),
  getCurrentTime: vi.fn(() => 0),
};

// @wavesurfer/react のモック
vi.mock('@wavesurfer/react', () => ({
  default: vi.fn(
    ({
      url,
      onReady,
    }: {
      url: string | null;
      onReady?: (ws: typeof mockWavesurfer) => void;
    }) => {
      // WavesurferPlayer コンポーネントのモック
      if (!url) return null;
      // onReady を次のティックで呼び出す
      if (onReady) {
        setTimeout(() => onReady(mockWavesurfer), 0);
      }
      return createElement('div', { 'data-testid': 'wavesurfer-player' });
    },
  ),
}));

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('audioUrl が null の場合 "No audio loaded" を表示する', () => {
    render(
      createElement(AudioPlayer, {
        label: 'Input',
        audioUrl: null,
      }),
    );
    expect(screen.getByText('No audio loaded')).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('label を正しく表示する', () => {
    render(
      createElement(AudioPlayer, {
        label: 'Output',
        audioUrl: null,
      }),
    );
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('audioUrl がある場合は Play ボタンを表示する', () => {
    render(
      createElement(AudioPlayer, {
        label: 'Input',
        audioUrl: 'http://example.com/audio.wav',
      }),
    );
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('audioUrl がない場合は Play ボタンを表示しない', () => {
    render(
      createElement(AudioPlayer, {
        label: 'Input',
        audioUrl: null,
      }),
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('デフォルトの時間表示は 0:00 / 0:00', () => {
    render(
      createElement(AudioPlayer, {
        label: 'Input',
        audioUrl: 'http://example.com/audio.wav',
      }),
    );
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
  });

  it('カスタムカラーを受け取れる', () => {
    const { container } = render(
      createElement(AudioPlayer, {
        label: 'Input',
        audioUrl: null,
        color: '#10b981',
      }),
    );
    expect(container.querySelector('.audio-player')).toBeInTheDocument();
  });

  it('Play ボタンクリックで playPause が呼ばれる', async () => {
    const user = userEvent.setup();
    render(
      createElement(AudioPlayer, {
        label: 'Input',
        audioUrl: 'http://example.com/audio.wav',
      }),
    );

    // onReady が呼ばれるまで待つ
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /play/i })).not.toBeDisabled();
    });

    const playButton = screen.getByRole('button', { name: /play/i });
    await user.click(playButton);

    expect(mockWavesurfer.playPause).toHaveBeenCalled();
  });

  it('ref 経由で pause を呼べる', async () => {
    const ref = createRef<AudioPlayerHandle>();
    render(
      createElement(AudioPlayer, {
        ref,
        label: 'Input',
        audioUrl: 'http://example.com/audio.wav',
      }),
    );

    // onReady が呼ばれてボタンが有効になるまで待つ
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /play/i })).not.toBeDisabled();
    });

    ref.current?.pause();

    expect(mockWavesurfer.pause).toHaveBeenCalled();
  });
});
