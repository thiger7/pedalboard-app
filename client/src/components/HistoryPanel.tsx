import { useRef } from 'react';
import type { JobResponse } from '../types/effects';
import './HistoryPanel.css';

interface HistoryPanelProps {
  jobs: JobResponse[];
  isLoading: boolean;
  recentlyCompletedIds: Set<string>;
  selectedJobId: string | null;
  onRefresh: () => void;
  onClear: () => void;
  onSelectJob: (job: JobResponse) => void;
  onClearHighlight: (jobId: string) => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: JobResponse['status']): string {
  switch (status) {
    case 'pending':
      return 'status-badge status-pending';
    case 'processing':
      return 'status-badge status-processing';
    case 'completed':
      return 'status-badge status-completed';
    case 'failed':
      return 'status-badge status-failed';
    default:
      return 'status-badge';
  }
}

function getStatusLabel(status: JobResponse['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export function HistoryPanel({
  jobs,
  isLoading,
  recentlyCompletedIds,
  selectedJobId,
  onRefresh,
  onClear,
  onSelectJob,
  onClearHighlight,
}: HistoryPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  if (jobs.length === 0 && !isLoading) {
    return null;
  }

  const handleAnimationEnd = (jobId: string) => {
    onClearHighlight(jobId);
  };

  return (
    <div className="history-panel">
      <div className="history-actions">
        <button
          type="button"
          onClick={onRefresh}
          className="history-button"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="history-button history-button-clear"
        >
          Clear
        </button>
      </div>
      <div className="history-list" ref={listRef}>
        {jobs.map((job) => {
          const isNewlyCompleted = recentlyCompletedIds.has(job.job_id);
          const isSelected = selectedJobId === job.job_id;
          return (
            <button
              key={job.job_id}
              type="button"
              className={`history-item ${isNewlyCompleted ? 'history-item-highlight' : ''} ${isSelected ? 'history-item-active' : ''}`}
              onClick={() => onSelectJob(job)}
              disabled={job.status !== 'completed'}
              onAnimationEnd={() =>
                isNewlyCompleted && handleAnimationEnd(job.job_id)
              }
            >
              <div className="history-item-info">
                <span className="history-item-filename">
                  {job.original_filename ?? 'Unknown file'}
                </span>
                <span className="history-item-effects">
                  {job.effect_chain.map((e) => e.name).join(', ')}
                </span>
                <span className="history-item-date">
                  {formatDate(job.created_at)}
                </span>
              </div>
              <span className={getStatusBadgeClass(job.status)}>
                {getStatusLabel(job.status)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
