import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FileSelector } from './FileSelector';

describe('FileSelector', () => {
  it('ローディング中は Loading... を表示する', () => {
    render(
      createElement(FileSelector, {
        files: [],
        selectedFile: '',
        onSelect: vi.fn(),
        isLoading: true,
      }),
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('ファイルがない場合はメッセージを表示する', () => {
    render(
      createElement(FileSelector, {
        files: [],
        selectedFile: '',
        onSelect: vi.fn(),
        isLoading: false,
      }),
    );
    expect(
      screen.getByText('No audio files found in audio/input/'),
    ).toBeInTheDocument();
  });

  it('ファイル一覧をセレクトボックスで表示する', () => {
    const files = ['test1.wav', 'test2.wav'];
    render(
      createElement(FileSelector, {
        files,
        selectedFile: '',
        onSelect: vi.fn(),
        isLoading: false,
      }),
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('test1.wav')).toBeInTheDocument();
    expect(screen.getByText('test2.wav')).toBeInTheDocument();
  });

  it('ファイル選択時に onSelect が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const files = ['test1.wav', 'test2.wav'];

    render(
      createElement(FileSelector, {
        files,
        selectedFile: '',
        onSelect,
        isLoading: false,
      }),
    );

    await user.selectOptions(screen.getByRole('combobox'), 'test1.wav');
    expect(onSelect).toHaveBeenCalledWith('test1.wav');
  });
});
