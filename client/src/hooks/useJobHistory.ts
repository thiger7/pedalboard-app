import axios from 'axios';
import { useCallback, useState } from 'react';
import type { BatchJobsResponse, JobResponse } from '../types/effects';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STORAGE_KEY = 'pedalboard_job_ids';
const MAX_HISTORY_SIZE = 50;

function saveToStorage(jobIds: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobIds));
  } catch {
    // Storage full or unavailable
  }
}

function loadFromStorage(): string[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useJobHistory() {
  const [jobIds, setJobIds] = useState<string[]>(loadFromStorage);
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(
    new Set(),
  );

  // ジョブIDを追加（同時にSession Storageに保存）
  const addJobId = useCallback((jobId: string) => {
    setJobIds((prev) => {
      const filtered = prev.filter((id) => id !== jobId);
      const newIds = [jobId, ...filtered].slice(0, MAX_HISTORY_SIZE);
      saveToStorage(newIds);
      return newIds;
    });
  }, []);

  // 履歴をクリア
  const clearHistory = useCallback(() => {
    setJobIds([]);
    setJobs([]);
    saveToStorage([]);
  }, []);

  // ジョブ情報を取得
  const fetchJobs = useCallback(async () => {
    const currentJobIds = loadFromStorage();
    if (currentJobIds.length === 0) {
      setJobs([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post<BatchJobsResponse>(
        `${API_BASE_URL}/api/jobs/batch`,
        { job_ids: currentJobIds },
      );
      // jobIds の順序を維持
      const jobMap = new Map(response.data.jobs.map((j) => [j.job_id, j]));
      const orderedJobs = currentJobIds
        .map((id) => jobMap.get(id))
        .filter((j): j is JobResponse => j !== undefined);
      setJobs(orderedJobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 単一ジョブのステータスを取得
  const fetchJobStatus = useCallback(
    async (jobId: string): Promise<JobResponse | null> => {
      try {
        const response = await axios.get<JobResponse>(
          `${API_BASE_URL}/api/jobs/${jobId}`,
        );
        // ローカル状態も更新
        setJobs((prev) =>
          prev.map((j) => (j.job_id === jobId ? response.data : j)),
        );
        return response.data;
      } catch {
        return null;
      }
    },
    [],
  );

  // ジョブをポーリング（完了まで）
  const pollJobUntilComplete = useCallback(
    async (
      jobId: string,
      interval = 2000,
      maxAttempts = 60,
    ): Promise<JobResponse | null> => {
      for (let i = 0; i < maxAttempts; i++) {
        const job = await fetchJobStatus(jobId);
        if (!job) return null;

        if (job.status === 'completed' || job.status === 'failed') {
          // 完了したらハイライト対象に追加
          setRecentlyCompletedIds((prev) => new Set(prev).add(jobId));
          return job;
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return null; // Timeout
    },
    [fetchJobStatus],
  );

  // ハイライトをクリア
  const clearHighlight = useCallback((jobId: string) => {
    setRecentlyCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  }, []);

  // 初期化（useAppModeと同じパターン）
  if (!initialized) {
    setInitialized(true);
    if (jobIds.length > 0) {
      fetchJobs();
    }
  }

  return {
    jobIds,
    jobs,
    isLoading,
    recentlyCompletedIds,
    addJobId,
    clearHistory,
    clearHighlight,
    fetchJobs,
    fetchJobStatus,
    pollJobUntilComplete,
  };
}
