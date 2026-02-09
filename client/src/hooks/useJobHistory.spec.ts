import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobResponse } from '../types/effects';
import { useJobHistory } from './useJobHistory';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('useJobHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();
  });

  describe('addJobId', () => {
    it('ジョブIDを追加する', () => {
      const { result } = renderHook(() => useJobHistory());

      act(() => {
        result.current.addJobId('job1');
      });

      expect(result.current.jobIds).toContain('job1');
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
    });

    it('重複するジョブIDは先頭に移動する', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(
        JSON.stringify(['job1', 'job2']),
      );

      const { result } = renderHook(() => useJobHistory());

      act(() => {
        result.current.addJobId('job2');
      });

      expect(result.current.jobIds[0]).toBe('job2');
    });

    it('最大50件まで保持する', () => {
      const existingIds = Array.from({ length: 50 }, (_, i) => `job${i}`);
      mockSessionStorage.getItem.mockReturnValueOnce(
        JSON.stringify(existingIds),
      );

      const { result } = renderHook(() => useJobHistory());

      act(() => {
        result.current.addJobId('newjob');
      });

      expect(result.current.jobIds.length).toBe(50);
      expect(result.current.jobIds[0]).toBe('newjob');
    });
  });

  describe('clearHistory', () => {
    it('履歴をクリアする', () => {
      mockSessionStorage.getItem.mockReturnValueOnce(
        JSON.stringify(['job1', 'job2']),
      );

      const { result } = renderHook(() => useJobHistory());

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.jobIds).toEqual([]);
      expect(result.current.jobs).toEqual([]);
    });
  });

  describe('fetchJobs', () => {
    it('ジョブ情報を取得する', async () => {
      mockSessionStorage.getItem.mockReturnValue(
        JSON.stringify(['job1', 'job2']),
      );
      const mockJobs = [
        {
          job_id: 'job1',
          status: 'completed',
          effect_chain: [],
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:31:00Z',
        },
        {
          job_id: 'job2',
          status: 'pending',
          effect_chain: [],
          created_at: '2024-01-15T10:32:00Z',
          updated_at: '2024-01-15T10:32:00Z',
        },
      ];
      (axios.post as Mock).mockResolvedValueOnce({ data: { jobs: mockJobs } });

      const { result } = renderHook(() => useJobHistory());

      await act(async () => {
        await result.current.fetchJobs();
      });

      expect(result.current.jobs.length).toBe(2);
      expect(result.current.jobs[0].job_id).toBe('job1');
    });

    it('空のジョブIDリストの場合はAPIを呼ばない', async () => {
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify([]));

      const { result } = renderHook(() => useJobHistory());

      await act(async () => {
        await result.current.fetchJobs();
      });

      expect(axios.post).not.toHaveBeenCalled();
      expect(result.current.jobs).toEqual([]);
    });
  });

  describe('fetchJobStatus', () => {
    it('単一ジョブのステータスを取得する', async () => {
      const mockJob = {
        job_id: 'job1',
        status: 'completed',
        effect_chain: [],
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:31:00Z',
      };
      (axios.get as Mock).mockResolvedValueOnce({ data: mockJob });

      const { result } = renderHook(() => useJobHistory());

      let job = null;
      await act(async () => {
        job = await result.current.fetchJobStatus('job1');
      });

      expect(job).toEqual(mockJob);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/jobs/job1'),
      );
    });

    it('エラー時はnullを返す', async () => {
      (axios.get as Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useJobHistory());

      let job = null;
      await act(async () => {
        job = await result.current.fetchJobStatus('job1');
      });

      expect(job).toBeNull();
    });
  });

  describe('pollJobUntilComplete', () => {
    it('完了したジョブを返す', async () => {
      const completedJob: JobResponse = {
        job_id: 'job1',
        status: 'completed',
        effect_chain: [],
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:31:00Z',
      };
      (axios.get as Mock).mockResolvedValue({ data: completedJob });

      const { result } = renderHook(() => useJobHistory());

      const job = await act(async () => {
        return result.current.pollJobUntilComplete('job1', 10, 3);
      });

      expect(job?.status).toBe('completed');
    });

    it('失敗したジョブを返す', async () => {
      const failedJob: JobResponse = {
        job_id: 'job1',
        status: 'failed',
        error_message: 'Processing error',
        effect_chain: [],
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:31:00Z',
      };
      (axios.get as Mock).mockResolvedValue({ data: failedJob });

      const { result } = renderHook(() => useJobHistory());

      const job = await act(async () => {
        return result.current.pollJobUntilComplete('job1', 10, 3);
      });

      expect(job?.status).toBe('failed');
    });
  });
});
