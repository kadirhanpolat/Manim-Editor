const PHASE_LABELS: Record<string, string> = {
  uploading: 'Uploading',
  saving: 'Saving',
  queued: 'Queued',
  running: 'Rendering',
  canceling: 'Canceling',
  failed: 'Failed',
  canceled: 'Canceled',
  completed: 'Completed',
};

export function renderPhaseLabel(status: string | null): string {
  return status ? PHASE_LABELS[status] ?? status : 'Idle';
}

export function renderQueuePosition(status: string | null, queueDepth: number | null): string | null {
  if (status !== 'queued' || queueDepth === null) return null;
  return `#${queueDepth + 1}`;
}

export function renderWorkerSummary(
  loading: boolean,
  workers: number | null,
  busy: number | null,
  stale: number | null
): string {
  if (loading) return 'Checking workers...';
  const parts: string[] = [];
  if (workers !== null) parts.push(`${workers} online`);
  if (busy !== null) parts.push(`${busy} busy`);
  if (stale !== null) parts.push(`${stale} stale`);
  return parts.length ? parts.join(' | ') : 'Unavailable';
}

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    const minutePart = minutes > 0 ? `${minutes}m ` : '';
    return `${hours}h ${minutePart}${String(seconds).padStart(2, '0')}s`.trim();
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export function renderDurationEstimateLabel(
  estimatedDurationMs: number | null,
  sampleCount: number | null
): string | null {
  if (!Number.isFinite(estimatedDurationMs ?? NaN) || (estimatedDurationMs ?? 0) <= 0) {
    return null;
  }
  const formatted = formatDurationMs(estimatedDurationMs as number);
  const base = `Estimated duration: ${formatted}`;
  if (sampleCount && sampleCount > 0) {
    return `${base} based on ${sampleCount} render${sampleCount === 1 ? '' : 's'}`;
  }
  return base;
}
