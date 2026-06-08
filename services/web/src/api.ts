/**
 * API Client for Manim Studio — v2
 *
 * Talks to the Node API running at /api (proxied by Nginx in Docker,
 * or directly at localhost:3000 in dev).
 */

const API_BASE = '/api';

/**
 * Make an API request.
 */
async function request(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
    ...options,
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = {
  list: () => request('/projects'),

  get: (id: string) => request(`/projects/${id}`),

  create: (name = 'My Animation', editorMode = 'visual') =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, editorMode }),
    }),

  update: (id: string, project: unknown) =>
    request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    }),

  delete: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),

  render: (id: string, quality = 'high') =>
    request(`/projects/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ quality }),
    }),

  renderCode: (
    id: string,
    {
      quality = 'high',
      codeSource,
      sceneName = 'MainScene',
    }: { quality?: string; codeSource?: string; sceneName?: string }
  ) =>
    request(`/projects/${id}/render-code`, {
      method: 'POST',
      body: JSON.stringify({ quality, codeSource, sceneName }),
    }),
};

// ─── Assets ───────────────────────────────────────────────────────────────────

export const assets = {
  list: (projectId: string) => request(`/assets/${projectId}`),

  /** Multipart file upload */
  upload: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/assets/${projectId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },

  /** Upload a base64 data-URL (used when syncing browser assets to server). */
  uploadBase64: (
    projectId: string,
    { name, type, data }: { name: string; type: string; data: string }
  ) =>
    request(`/assets/${projectId}/base64`, {
      method: 'POST',
      body: JSON.stringify({ name, type, data }),
    }),

  getUrl: (projectId: string, filename: string) => `${API_BASE}/assets/${projectId}/${filename}`,

  delete: (projectId: string, filename: string) =>
    request(`/assets/${projectId}/${filename}`, { method: 'DELETE' }),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = {
  get: (jobId: string) => request(`/jobs/${jobId}`),
};

// ─── Renders ──────────────────────────────────────────────────────────────────

export const renders = {
  getLatestUrl: (projectId: string) =>
    `${API_BASE}/renders/${projectId}/latest.mp4?t=${Date.now()}`,
  getInfo: (projectId: string) => request(`/renders/${projectId}`),
};

// ─── Audio ────────────────────────────────────────────────────────────────────

export const audio = {
  /** Upload an audio file. Returns { audioId, src, duration, status }. */
  upload: async (file: File, clipId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (clipId) formData.append('clipId', clipId);

    const response = await fetch(`${API_BASE}/audio/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err: any = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || 'Audio upload failed');
    }
    return response.json();
  },

  /** Create a TTS job. Returns { jobId, status }. */
  tts: (clipId: string, type: string, text: string, lang = 'tr') =>
    request('/audio/tts', {
      method: 'POST',
      body: JSON.stringify({ clipId, type, text, lang }),
    }),

  /** Delete an audio file. */
  delete: (audioId: string) => request(`/audio/${audioId}`, { method: 'DELETE' }),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

/**
 * Connect to the job WebSocket and subscribe to updates for a specific job.
 */
export function connectJobWebSocket(
  jobId: string,
  onUpdate: (msg: {
    status?: string;
    stdout?: string;
    stderr?: string;
    error?: string;
    [k: string]: unknown;
  }) => void
): () => void {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', jobId }));
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        type?: string;
        jobId?: string;
        status?: string;
        stdout?: string;
        stderr?: string;
        error?: string;
        [k: string]: unknown;
      };
      if (msg.type === 'job_update' && msg.jobId === jobId) onUpdate(msg);
    } catch {
      /* ignore */
    }
  };
  ws.onerror = () => ws.close();

  return () => ws.close();
}

/**
 * Subscribe to audio job updates via WebSocket.
 */
export function connectAudioWebSocket(
  jobId: string,
  onUpdate: (data: {
    event: string;
    clipId?: string;
    duration?: number;
    src?: string;
    error?: string;
    [k: string]: unknown;
  }) => void
): () => void {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe_audio', jobId }));
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as {
        event: string;
        clipId?: string;
        duration?: number;
        src?: string;
        error?: string;
        [k: string]: unknown;
      };
      if (data.event === 'audio_ready' || data.event === 'audio_error') {
        onUpdate(data);
        ws.close();
      }
    } catch {
      /* ignore */
    }
  };
  ws.onerror = () => onUpdate({ event: 'audio_error', error: 'WebSocket error' });

  return () => ws.close();
}

export default {
  projects,
  assets,
  jobs,
  renders,
  audio,
  checkHealth,
  connectJobWebSocket,
  connectAudioWebSocket,
};
