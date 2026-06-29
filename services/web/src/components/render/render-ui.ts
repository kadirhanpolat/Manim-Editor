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
  return parts.length ? parts.join(' · ') : 'Unavailable';
}
