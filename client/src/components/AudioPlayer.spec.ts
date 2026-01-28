import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer } from './AudioPlayer';

// WaveSurfer のモック
vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => ({
      load: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      playPause: vi.fn(),
      getDuration: vi.fn(() => 0),
    })),
  },
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
});
