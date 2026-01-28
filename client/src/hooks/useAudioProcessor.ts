import axios from 'axios';
import { useCallback, useState } from 'react';
import type { ProcessRequest, ProcessResponse } from '../types/effects';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useAudioProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);

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
    getAudioUrl,
    getInputAudioUrl,
    getNormalizedAudioUrl,
    isProcessing,
    error,
    result,
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
