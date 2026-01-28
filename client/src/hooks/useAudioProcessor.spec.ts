import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioProcessor, useInputFiles } from './useAudioProcessor';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

describe('useAudioProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAudioUrl', () => {
    it('正しい URL を返す', () => {
      const { result } = renderHook(() => useAudioProcessor());
      const url = result.current.getAudioUrl('test.wav');
      expect(url).toBe('http://localhost:8000/api/audio/test.wav');
    });
  });

  describe('getInputAudioUrl', () => {
    it('正しい URL を返す', () => {
      const { result } = renderHook(() => useAudioProcessor());
      const url = result.current.getInputAudioUrl('test.wav');
      expect(url).toBe('http://localhost:8000/api/input-audio/test.wav');
    });
  });

  describe('getNormalizedAudioUrl', () => {
    it('正しい URL を返す', () => {
      const { result } = renderHook(() => useAudioProcessor());
      const url = result.current.getNormalizedAudioUrl('test.wav');
      expect(url).toBe('http://localhost:8000/api/normalized/test.wav');
    });
  });

  describe('processAudio', () => {
    it('成功時に結果を返す', async () => {
      const mockResponse = {
        data: {
          output_file: 'output.wav',
          download_url: '/api/audio/output.wav',
          effects_applied: ['Chorus'],
          input_normalized: 'input_norm.wav',
          output_normalized: 'output_norm.wav',
        },
      };
      (axios.post as Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useAudioProcessor());

      let response: typeof mockResponse.data | null = null;
      await waitFor(async () => {
        response = await result.current.processAudio({
          input_file: 'test.wav',
          effect_chain: [{ name: 'Chorus' }],
        });
      });

      expect(response).toEqual(mockResponse.data);
    });

    it('エラー時にエラーメッセージを設定する', async () => {
      (axios.post as Mock).mockRejectedValueOnce(new Error('Network Error'));
      (axios.isAxiosError as unknown as Mock).mockReturnValue(false);

      const { result } = renderHook(() => useAudioProcessor());

      let response: unknown = null;
      await waitFor(async () => {
        response = await result.current.processAudio({
          input_file: 'test.wav',
          effect_chain: [],
        });
      });

      expect(response).toBeNull();
    });
  });
});

describe('useInputFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ファイル一覧を取得する', async () => {
    const mockFiles = ['file1.wav', 'file2.wav'];
    (axios.get as Mock).mockResolvedValueOnce({ data: { files: mockFiles } });

    const { result } = renderHook(() => useInputFiles());

    expect(result.current.files).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    result.current.fetchFiles();

    await waitFor(() => {
      expect(result.current.files).toEqual(mockFiles);
    });
  });

  it('エラー時も正常に処理する', async () => {
    (axios.get as Mock).mockRejectedValueOnce(new Error('Network Error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useInputFiles());

    result.current.fetchFiles();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
