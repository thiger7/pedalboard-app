import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { JobResponse } from '../types/effects';
import { HistoryPanel } from './HistoryPanel';

const createMockJob = (overrides: Partial<JobResponse> = {}): JobResponse => ({
  job_id: 'job1',
  status: 'completed',
  effect_chain: [{ name: 'Reverb' }],
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-15T10:31:00Z',
  ...overrides,
});

const defaultProps = {
  isLoading: false,
  recentlyCompletedIds: new Set<string>(),
  selectedJobId: null as string | null,
  onRefresh: vi.fn(),
  onClear: vi.fn(),
  onSelectJob: vi.fn(),
  onClearHighlight: vi.fn(),
};

describe('HistoryPanel', () => {
  it('ジョブがない場合は何も表示しない', () => {
    const { container } = render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs: [],
      }),
    );

    expect(container.firstChild).toBeNull();
  });

  it('ジョブ一覧を表示する', () => {
    const jobs = [
      createMockJob({ job_id: 'job1', effect_chain: [{ name: 'Reverb' }] }),
      createMockJob({
        job_id: 'job2',
        effect_chain: [{ name: 'Chorus' }, { name: 'Delay' }],
      }),
    ];

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs,
      }),
    );

    expect(screen.getByText('Reverb')).toBeInTheDocument();
    expect(screen.getByText('Chorus, Delay')).toBeInTheDocument();
  });

  it('ステータスバッジを表示する', () => {
    const jobs = [
      createMockJob({ status: 'completed' }),
      createMockJob({ job_id: 'job2', status: 'pending' }),
      createMockJob({ job_id: 'job3', status: 'processing' }),
      createMockJob({ job_id: 'job4', status: 'failed' }),
    ];

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs,
      }),
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('Refreshボタンをクリックするとコールバックが呼ばれる', () => {
    const onRefresh = vi.fn();
    const jobs = [createMockJob()];

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs,
        onRefresh,
      }),
    );

    fireEvent.click(screen.getByText('Refresh'));

    expect(onRefresh).toHaveBeenCalled();
  });

  it('Clearボタンをクリックするとコールバックが呼ばれる', () => {
    const onClear = vi.fn();
    const jobs = [createMockJob()];

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs,
        onClear,
      }),
    );

    fireEvent.click(screen.getByText('Clear'));

    expect(onClear).toHaveBeenCalled();
  });

  it('完了したジョブをクリックするとコールバックが呼ばれる', () => {
    const onSelectJob = vi.fn();
    const job = createMockJob({ status: 'completed' });

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs: [job],
        onSelectJob,
      }),
    );

    fireEvent.click(screen.getByText('Reverb'));

    expect(onSelectJob).toHaveBeenCalledWith(job);
  });

  it('未完了のジョブはクリックできない', () => {
    const onSelectJob = vi.fn();
    const job = createMockJob({ status: 'pending' });

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs: [job],
        onSelectJob,
      }),
    );

    const button = screen.getByRole('button', { name: /Reverb/i });
    expect(button).toBeDisabled();
  });

  it('ローディング中はRefreshボタンが無効になる', () => {
    const jobs = [createMockJob()];

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs,
        isLoading: true,
      }),
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Loading...').closest('button')).toBeDisabled();
  });

  it('選択中のジョブにactiveクラスが付与される', () => {
    const jobs = [
      createMockJob({ job_id: 'job1' }),
      createMockJob({ job_id: 'job2' }),
    ];

    render(
      createElement(HistoryPanel, {
        ...defaultProps,
        jobs,
        selectedJobId: 'job1',
      }),
    );

    const buttons = screen.getAllByRole('button', { name: /Reverb/i });
    expect(buttons[0]).toHaveClass('history-item-active');
    expect(buttons[1]).not.toHaveClass('history-item-active');
  });
});
