import axios from 'axios';
import { useCallback, useState } from 'react';
import type {
  EffectConfig,
  ProcessRequest,
  ProcessResponse,
  S3ProcessAsyncResponse,
  S3ProcessResponse,
  UploadUrlResponse,
} from '../types/effects';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type AppMode = 'local' | 's3' | 'unknown';

export function useAppMode() {
  const [mode, setMode] = useState<AppMode>('unknown');
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  if (!initialized) {
    setInitialized(true);
    (async () => {
      try {
        const response = await axios.get<{ status: string; mode: AppMode }>(
          `${API_BASE_URL}/api/health`,
        );
        const detectedMode = response.data.mode;
        setMode(detectedMode);

        // local モードなら files も取得
        if (detectedMode === 'local') {
          const filesResponse = await axios.get<{ files: string[] }>(
            `${API_BASE_URL}/api/input-files`,
          );
          setFiles(filesResponse.data.files);
        }
      } catch {
        setMode('local');
      } finally {
        setIsLoading(false);
      }
    })();
  }

  return { mode, files, isLoading };
}

export function useAudioProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [s3Result, setS3Result] = useState<S3ProcessResponse | null>(null);

  const processAudio = useCallback(
    async (request: ProcessRequest): Promise<ProcessResponse | null> => {
      setIsProcessing(true);
      setError(null);

      try {
        const response = await axios.post<ProcessResponse>(
          `${API_BASE_URL}/api/process`,
          request,
        );
        setResult(response.data);
        return response.data;
      } catch (err) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Unknown error occurred';
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const processS3Audio = useCallback(
    async (
      s3Key: string,
      effectChain: EffectConfig[],
      originalFilename?: string,
    ): Promise<S3ProcessResponse | null> => {
      setIsProcessing(true);
      setError(null);

      try {
        const response = await axios.post<S3ProcessResponse>(
          `${API_BASE_URL}/api/s3-process-sync`,
          {
            s3_key: s3Key,
            effect_chain: effectChain,
            original_filename: originalFilename,
          },
        );
        setS3Result(response.data);
        return response.data;
      } catch (err) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Unknown error occurred';
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const processS3AudioAsync = useCallback(
    async (
      s3Key: string,
      effectChain: EffectConfig[],
      originalFilename?: string,
    ): Promise<S3ProcessAsyncResponse | null> => {
      setIsProcessing(true);
      setError(null);

      try {
        const response = await axios.post<S3ProcessAsyncResponse>(
          `${API_BASE_URL}/api/s3-process`,
          {
            s3_key: s3Key,
            effect_chain: effectChain,
            original_filename: originalFilename,
          },
        );
        return response.data;
      } catch (err) {
        const message = axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Unknown error occurred';
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const getAudioUrl = useCallback((filename: string): string => {
    return `${API_BASE_URL}/api/audio/${filename}`;
  }, []);

  const getInputAudioUrl = useCallback((filename: string): string => {
    return `${API_BASE_URL}/api/input-audio/${filename}`;
  }, []);

  const getNormalizedAudioUrl = useCallback((filename: string): string => {
    return `${API_BASE_URL}/api/normalized/${filename}`;
  }, []);

  return {
    processAudio,
    processS3Audio,
    processS3AudioAsync,
    getAudioUrl,
    getInputAudioUrl,
    getNormalizedAudioUrl,
    isProcessing,
    error,
    result,
    s3Result,
  };
}

export function useInputFiles() {
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get<{ files: string[] }>(
        `${API_BASE_URL}/api/input-files`,
      );
      setFiles(response.data.files);
    } catch (err) {
      console.error('Failed to fetch input files:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    files,
    isLoading,
    fetchFiles,
  };
}

export function useS3Upload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Get presigned URL
      const urlResponse = await axios.post<UploadUrlResponse>(
        `${API_BASE_URL}/api/upload-url`,
        {
          filename: file.name,
          content_type: file.type || 'audio/wav',
        },
      );

      const { upload_url, s3_key } = urlResponse.data;

      // 2. Upload to S3 using presigned URL
      await axios.put(upload_url, file, {
        headers: {
          'Content-Type': file.type || 'audio/wav',
        },
      });

      setUploadedKey(s3_key);
      return s3_key;
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.detail || err.message
        : 'Upload failed';
      setUploadError(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedKey(null);
    setUploadError(null);
  }, []);

  return {
    uploadFile,
    clearUpload,
    isUploading,
    uploadError,
    uploadedKey,
  };
}
