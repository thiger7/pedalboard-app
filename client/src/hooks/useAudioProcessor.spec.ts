import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAppMode,
  useAudioProcessor,
  useInputFiles,
  useS3Upload,
} from './useAudioProcessor';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
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

describe('useAppMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('health エンドポイントから local モードを取得する', async () => {
    (axios.get as Mock).mockResolvedValueOnce({
      data: { status: 'ok', mode: 'local' },
    });

    const { result } = renderHook(() => useAppMode());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mode).toBe('local');
  });

  it('health エンドポイントから s3 モードを取得する', async () => {
    (axios.get as Mock).mockResolvedValueOnce({
      data: { status: 'ok', mode: 's3' },
    });

    const { result } = renderHook(() => useAppMode());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mode).toBe('s3');
  });

  it('エラー時は local モードにフォールバックする', async () => {
    (axios.get as Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAppMode());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mode).toBe('local');
  });
});

describe('processS3Audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('S3 音声を処理して正規化 URL を返す', async () => {
    const mockResponseData = {
      output_key: 'output/abc.wav',
      download_url: 'https://s3.example.com/output.wav',
      effects_applied: ['reverb'],
      input_normalized_url: 'https://s3.example.com/input_norm.wav',
      output_normalized_url: 'https://s3.example.com/output_norm.wav',
    };
    (axios.post as Mock).mockResolvedValueOnce({ data: mockResponseData });

    const { result } = renderHook(() => useAudioProcessor());

    await act(async () => {
      const response = await result.current.processS3Audio('input/test.wav', [
        { name: 'reverb' },
      ]);

      expect(response).toEqual(mockResponseData);
      expect(response?.input_normalized_url).toBe(
        'https://s3.example.com/input_norm.wav',
      );
      expect(response?.output_normalized_url).toBe(
        'https://s3.example.com/output_norm.wav',
      );
    });
  });

  it('エラー時にエラーメッセージを設定する', async () => {
    (axios.post as Mock).mockRejectedValueOnce(new Error('Network Error'));
    (axios.isAxiosError as unknown as Mock).mockReturnValue(false);

    const { result } = renderHook(() => useAudioProcessor());

    await act(async () => {
      const response = await result.current.processS3Audio(
        'input/test.wav',
        [],
      );
      expect(response).toBeNull();
    });

    expect(result.current.error).toBe('Unknown error occurred');
  });
});

describe('useS3Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ファイルを正常にアップロードする', async () => {
    (axios.post as Mock).mockResolvedValueOnce({
      data: {
        upload_url: 'https://s3.example.com/upload',
        s3_key: 'input/abc.wav',
      },
    });
    (axios.put as Mock).mockResolvedValueOnce({});

    const { result } = renderHook(() => useS3Upload());

    const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

    let s3Key: string | null = null;
    await act(async () => {
      s3Key = await result.current.uploadFile(file);
    });

    expect(s3Key).toBe('input/abc.wav');
    expect(result.current.uploadedKey).toBe('input/abc.wav');
    expect(result.current.isUploading).toBe(false);
  });

  it('アップロードエラーを処理する', async () => {
    (axios.post as Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: 'Upload failed' } },
    });

    const { result } = renderHook(() => useS3Upload());

    const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

    let s3Key: string | null = null;
    await act(async () => {
      s3Key = await result.current.uploadFile(file);
    });

    expect(s3Key).toBeNull();
    expect(result.current.uploadError).toBeTruthy();
  });

  it('アップロード状態をクリアする', async () => {
    (axios.post as Mock).mockResolvedValueOnce({
      data: {
        upload_url: 'https://s3.example.com/upload',
        s3_key: 'input/abc.wav',
      },
    });
    (axios.put as Mock).mockResolvedValueOnce({});

    const { result } = renderHook(() => useS3Upload());

    const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(result.current.uploadedKey).toBe('input/abc.wav');

    act(() => {
      result.current.clearUpload();
    });

    expect(result.current.uploadedKey).toBeNull();
  });
});
