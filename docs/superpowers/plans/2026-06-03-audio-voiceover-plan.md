# Audio / Voiceover (manim-voiceover) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-clip audio support (file upload + gTTS + Coqui TTS) with auto/manual sync, VoiceoverScene codegen, and a dedicated Docker audio service.

**Architecture:** A new `services/audio` Docker service consumes Redis jobs (`audio:queue:gtts` / `audio:queue:coqui`), generates `.wav` files under `/data/assets/audio/`, and notifies the API via HTTP callback. The API broadcasts `audio_ready`/`audio_error` over the existing WebSocket. The renderer uses `manim-voiceover` with pre-generated `.wav` files.

**Tech Stack:** Node.js/Express (API), Vue 2.7 (frontend), Python + gTTS + Coqui TTS (audio service), manim-voiceover + ffmpeg (renderer), Redis (job queue), WebSocket (ws.js push).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| CREATE | `services/audio/Dockerfile` | Python + ffmpeg + gTTS image |
| CREATE | `services/audio/Dockerfile.coqui` | Adds Coqui TTS to audio image |
| CREATE | `services/audio/requirements.txt` | gTTS + redis deps |
| CREATE | `services/audio/requirements.coqui.txt` | + TTS (Coqui) package |
| CREATE | `services/audio/worker.py` | Redis consumer; gTTS + Coqui + API callback |
| CREATE | `services/api/src/routes/audio.js` | Upload, TTS job, callback, delete endpoints |
| CREATE | `services/web/src/components/inspector/AudioPanel.vue` | "Ses" tab in Inspector |
| CREATE | `services/web/tests/components/audio.test.js` | Store audio action tests |
| CREATE | `services/web/tests/components/audio-codegen.test.js` | Codegen VoiceoverScene tests |
| MODIFY | `docker-compose.yml` | Add audio service, Coqui profile, audio dir init |
| MODIFY | `services/api/src/queue.js` | Add `enqueueAudioJob`, `getAudioJobStatus`, `updateAudioJobStatus` |
| MODIFY | `services/api/src/ws.js` | Add `subscribe_audio` message type + `pollUntilAudioDone` |
| MODIFY | `services/api/src/index.js` | Register `/api/audio` routes |
| MODIFY | `services/web/src/api.js` | Add `audio.*` methods + `connectAudioWebSocket` |
| MODIFY | `services/web/src/store/project.js` | Add `setClipAudio`, `removeClipAudio`; `hasPendingAudio` getter |
| MODIFY | `services/web/src/components/inspector/Inspector.vue` | Add AudioPanel tab |
| MODIFY | `services/web/src/components/timeline/TimelineBlock.vue` | Audio strip below clip |
| MODIFY | `services/api/src/compiler/codegen.js` | VoiceoverScene detection + `with self.voiceover()` wrapping |
| MODIFY | `services/web/src/export/manim.js` | Mirror codegen.js changes |
| MODIFY | `services/renderer/Dockerfile` | Add `manim-voiceover` pip install |
| MODIFY | `services/renderer/worker.py` | Ensure `/data/assets/audio` accessible before render |

---

## Task 1: Audio Queue Functions

**Files:**
- Modify: `services/api/src/queue.js`

- [ ] **Step 1: Add three functions to queue.js** after the existing `getJobStatus` export:

```js
/**
 * Enqueue an audio TTS job.
 * @param {Object} job - { jobId, clipId, type: 'gtts'|'coqui', text, lang }
 */
export async function enqueueAudioJob(job) {
  const redis = await getRedisClient();
  await redis.hSet(`audio:job:${job.jobId}`, {
    status: 'pending',
    clipId: job.clipId,
    type: job.type,
    text: job.text || '',
    lang: job.lang || 'tr',
    createdAt: new Date().toISOString()
  });
  const queueKey = job.type === 'coqui' ? 'audio:queue:coqui' : 'audio:queue:gtts';
  await redis.rPush(queueKey, JSON.stringify(job));
  return job.jobId;
}

/**
 * Get audio job status.
 */
export async function getAudioJobStatus(jobId) {
  const redis = await getRedisClient();
  const job = await redis.hGetAll(`audio:job:${jobId}`);
  if (!job || Object.keys(job).length === 0) return null;
  return job;
}

/**
 * Update fields on an audio job hash.
 */
export async function updateAudioJobStatus(jobId, updates) {
  const redis = await getRedisClient();
  const stringified = {};
  for (const [k, v] of Object.entries(updates)) stringified[k] = String(v);
  await redis.hSet(`audio:job:${jobId}`, stringified);
}
```

- [ ] **Step 2: Commit**

```bash
git add services/api/src/queue.js
git commit -m "feat: add audio job queue functions to queue.js"
```

---

## Task 2: Store Audio Actions + Tests (TDD)

**Files:**
- Create: `services/web/tests/components/audio.test.js`
- Modify: `services/web/src/store/project.js`

- [ ] **Step 1: Write failing tests**

Create `services/web/tests/components/audio.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { store, actions, getters } from '../../src/store/project.js';

beforeEach(() => {
  actions.newProject('Test', 'visual');
  actions.commitState();
});

describe('setClipAudio', () => {
  it('adds audio field to a clip', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', text: 'Merhaba', lang: 'tr', syncMode: 'auto', status: 'pending' });
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.audio.type).toBe('gtts');
    expect(found.audio.text).toBe('Merhaba');
    expect(found.audio.status).toBe('pending');
  });

  it('auto syncMode updates clip.duration when audio becomes ready', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'ready', duration: 3.5, src: '/data/assets/audio/x.wav' });
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.duration).toBe(3.5);
  });

  it('manual syncMode does not change clip.duration when audio becomes ready', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'file', syncMode: 'manual', status: 'ready', duration: 4.0, src: '/data/assets/audio/x.wav' });
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.duration).toBe(2); // unchanged
  });
});

describe('removeClipAudio', () => {
  it('removes audio field from clip', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    actions.removeClipAudio(clip.id);
    const found = store.project.tracks[0].clips.find(c => c.id === clip.id);
    expect(found.audio).toBeUndefined();
  });

  it('is a no-op for clip without audio', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    expect(() => actions.removeClipAudio(clip.id)).not.toThrow();
  });
});

describe('hasPendingAudio getter', () => {
  it('returns false when no clips have audio', () => {
    expect(getters.hasPendingAudio()).toBe(false);
  });

  it('returns true when a clip has pending audio', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'pending' });
    expect(getters.hasPendingAudio()).toBe(true);
  });

  it('returns false when all audio is ready', () => {
    const clip = actions.addClip(0, { type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: {} });
    actions.setClipAudio(clip.id, { type: 'gtts', syncMode: 'auto', status: 'ready', src: '/data/assets/audio/x.wav' });
    expect(getters.hasPendingAudio()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/web && npm run test:unit -- audio.test.js
```

Expected: fail with `actions.setClipAudio is not a function`

- [ ] **Step 3: Add `hasPendingAudio` getter to `getters` object in `project.js`**

In `services/web/src/store/project.js`, inside the `getters` object after `objectsAtTime`:

```js
  hasPendingAudio() {
    return store.project.tracks.some(t =>
      t.clips.some(c => c.audio && c.audio.status === 'pending')
    );
  }
```

- [ ] **Step 4: Add `setClipAudio` and `removeClipAudio` to `actions` in `project.js`**

Inside the `actions` object, after `deleteClip`:

```js
  setClipAudio(clipId, audioData) {
    for (const track of store.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        Vue.set(clip, 'audio', { ...audioData });
        if (audioData.syncMode === 'auto' && audioData.status === 'ready' && audioData.duration) {
          Vue.set(clip, 'duration', audioData.duration);
        }
        store.isDirty = true;
        return;
      }
    }
  },

  removeClipAudio(clipId) {
    for (const track of store.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip && clip.audio) {
        Vue.delete(clip, 'audio');
        store.isDirty = true;
        return;
      }
    }
  },
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd services/web && npm run test:unit -- audio.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd services/web && npm run test:unit && npm test
```

Expected: 47 unit + 89 engine tests pass.

- [ ] **Step 7: Commit**

```bash
git add services/web/src/store/project.js services/web/tests/components/audio.test.js
git commit -m "feat: add setClipAudio, removeClipAudio actions and hasPendingAudio getter"
```

---

## Task 3: Audio API Routes

**Files:**
- Create: `services/api/src/routes/audio.js`
- Modify: `services/api/src/index.js`

- [ ] **Step 1: Create `services/api/src/routes/audio.js`**

```js
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { enqueueAudioJob, getAudioJobStatus, updateAudioJobStatus } from '../queue.js';
import { broadcastAudioEvent } from '../ws.js';

const router = Router();

const ALLOWED_AUDIO = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

const audioStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(req.dataDir, 'assets', 'audio');
    await fs.mkdir(dir, { recursive: true, mode: 0o777 });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED_AUDIO[file.mimetype] || 'wav';
    cb(null, `${uuidv4().replace(/-/g, '')}.${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AUDIO[file.mimetype]) cb(null, true);
    else cb(new Error(`Audio type not allowed: ${file.mimetype}`), false);
  },
  limits: { fileSize: 100 * 1024 * 1024 }
});

/**
 * Upload an audio file and return duration via ffprobe.
 * POST /api/audio/upload
 * Body: multipart, field "file" + field "clipId"
 */
router.post('/upload', audioUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;

    // Get duration with ffprobe
    let duration = 0;
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'quiet', '-print_format', 'json', '-show_streams', filePath
      ]);
      const data = JSON.parse(stdout);
      for (const stream of (data.streams || [])) {
        if (stream.codec_type === 'audio') {
          duration = parseFloat(stream.duration || 0);
          break;
        }
      }
    } catch (e) {
      console.error('[audio] ffprobe failed:', e.message);
    }

    res.status(201).json({
      audioId: path.basename(filePath),
      src: `/data/assets/audio/${path.basename(filePath)}`,
      duration,
      status: 'ready'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Create a TTS audio job.
 * POST /api/audio/tts
 * Body: { clipId, type: 'gtts'|'coqui', text, lang }
 */
router.post('/tts', async (req, res, next) => {
  try {
    const { clipId, type, text, lang } = req.body;
    if (!clipId) return res.status(400).json({ error: 'clipId required' });
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
    if (!['gtts', 'coqui'].includes(type)) return res.status(400).json({ error: 'type must be gtts or coqui' });

    const jobId = uuidv4().replace(/-/g, '');
    await enqueueAudioJob({ jobId, clipId, type, text: text.trim(), lang: lang || 'tr' });

    res.status(201).json({ jobId, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

/**
 * Audio worker callback — called by audio service when job completes.
 * POST /api/audio/:jobId/complete
 * Body: { status: 'ready'|'error', clipId, duration?, error? }
 */
router.post('/:jobId/complete', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status, clipId, duration, error } = req.body;

    const updates = { status };
    if (duration != null) updates.duration = String(duration);
    if (error) updates.error = error;
    await updateAudioJobStatus(jobId, updates);

    const audioSrc = `/data/assets/audio/${jobId}.wav`;

    broadcastAudioEvent(jobId, {
      event: status === 'ready' ? 'audio_ready' : 'audio_error',
      jobId,
      clipId,
      duration: duration ? parseFloat(duration) : undefined,
      src: status === 'ready' ? audioSrc : undefined,
      error: error || undefined
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Get audio job status.
 * GET /api/audio/:jobId/status
 */
router.get('/:jobId/status', async (req, res, next) => {
  try {
    const job = await getAudioJobStatus(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * Delete an audio file.
 * DELETE /api/audio/:audioId
 */
router.delete('/:audioId', async (req, res, next) => {
  try {
    const audioId = req.params.audioId.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = path.join(req.dataDir, 'assets', 'audio', audioId);
    await fs.unlink(filePath).catch(() => {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register audio routes in `services/api/src/index.js`**

Add after `import fontsRouter`:
```js
import audioRouter    from './routes/audio.js';
```

Add after `app.use('/api/fonts', fontsRouter);`:
```js
app.use('/api/audio',    audioRouter);
```

Also add audio dir to the init path in the `DATA_DIR` setup (no code change needed — audio service creates this dir).

- [ ] **Step 3: Commit**

```bash
git add services/api/src/routes/audio.js services/api/src/index.js
git commit -m "feat: add audio API routes (upload, tts, complete callback, delete)"
```

---

## Task 4: WebSocket Audio Events

**Files:**
- Modify: `services/api/src/ws.js`

- [ ] **Step 1: Add `broadcastAudioEvent` export and `subscribe_audio` handling to `ws.js`**

Replace the full content of `services/api/src/ws.js` with:

```js
import { WebSocketServer } from 'ws';
import { getJobStatus, getAudioJobStatus } from './queue.js';

const DONE_STATUSES = new Set(['completed', 'failed']);
const AUDIO_DONE    = new Set(['ready', 'error']);

const subscriptions      = new Map(); // jobId -> Set<WebSocket>  (render jobs)
const audioSubscriptions = new Map(); // jobId -> Set<WebSocket>  (audio jobs)
const activePolls        = new Set();
const activeAudioPolls   = new Set();

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.type === 'subscribe' && msg.jobId) {
        if (!subscriptions.has(msg.jobId)) subscriptions.set(msg.jobId, new Set());
        subscriptions.get(msg.jobId).add(ws);
        if (!activePolls.has(msg.jobId)) {
          activePolls.add(msg.jobId);
          pollUntilDone(msg.jobId).finally(() => activePolls.delete(msg.jobId));
        }
      }

      if (msg.type === 'subscribe_audio' && msg.jobId) {
        if (!audioSubscriptions.has(msg.jobId)) audioSubscriptions.set(msg.jobId, new Set());
        audioSubscriptions.get(msg.jobId).add(ws);
        if (!activeAudioPolls.has(msg.jobId)) {
          activeAudioPolls.add(msg.jobId);
          pollUntilAudioDone(msg.jobId).finally(() => activeAudioPolls.delete(msg.jobId));
        }
      }
    });

    ws.on('close', () => {
      for (const [jobId, clients] of subscriptions.entries()) {
        clients.delete(ws);
        if (clients.size === 0) subscriptions.delete(jobId);
      }
      for (const [jobId, clients] of audioSubscriptions.entries()) {
        clients.delete(ws);
        if (clients.size === 0) audioSubscriptions.delete(jobId);
      }
    });
  });
}

function broadcast(jobId, payload) {
  const clients = subscriptions.get(jobId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function broadcastAudioEvent(jobId, payload) {
  const clients = audioSubscriptions.get(jobId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
  audioSubscriptions.delete(jobId);
}

async function pollUntilDone(jobId) {
  let errors = 0;
  while (subscriptions.has(jobId)) {
    await new Promise((r) => setTimeout(r, 500));
    const job = await getJobStatus(jobId).catch(() => { errors++; return null; });
    if (!job) {
      if (errors > 10) { subscriptions.delete(jobId); break; }
      continue;
    }
    errors = 0;
    broadcast(jobId, {
      type: 'job_update',
      jobId,
      status: job.status,
      stdout: job.stdout || '',
      stderr: job.stderr || '',
      error:  job.error  || '',
    });
    if (DONE_STATUSES.has(job.status)) {
      subscriptions.delete(jobId);
      break;
    }
  }
}

async function pollUntilAudioDone(jobId) {
  let errors = 0;
  while (audioSubscriptions.has(jobId)) {
    await new Promise((r) => setTimeout(r, 500));
    const job = await getAudioJobStatus(jobId).catch(() => { errors++; return null; });
    if (!job) {
      if (errors > 10) { audioSubscriptions.delete(jobId); break; }
      continue;
    }
    errors = 0;
    if (AUDIO_DONE.has(job.status)) {
      broadcastAudioEvent(jobId, {
        event: job.status === 'ready' ? 'audio_ready' : 'audio_error',
        jobId,
        clipId: job.clipId,
        duration: job.duration ? parseFloat(job.duration) : undefined,
        src: job.status === 'ready' ? `/data/assets/audio/${jobId}.wav` : undefined,
        error: job.error || undefined
      });
      break;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/api/src/ws.js
git commit -m "feat: add audio WebSocket events (subscribe_audio, broadcastAudioEvent)"
```

---

## Task 5: api.js Audio Methods + WebSocket Helper

**Files:**
- Modify: `services/web/src/api.js`

- [ ] **Step 1: Add audio section to `api.js`**

After the `renders` section and before `checkHealth`, add:

```js
// ─── Audio ────────────────────────────────────────────────────────────────────

export const audio = {
  /** Upload an audio file. Returns { audioId, src, duration, status }. */
  upload: async (file, clipId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clipId', clipId);

    const response = await fetch(`${API_BASE}/audio/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || 'Audio upload failed');
    }
    return response.json();
  },

  /** Create a TTS job. Returns { jobId, status }. */
  tts: (clipId, type, text, lang = 'tr') =>
    request('/audio/tts', {
      method: 'POST',
      body: JSON.stringify({ clipId, type, text, lang })
    }),

  /** Delete an audio file. */
  delete: (audioId) =>
    request(`/audio/${audioId}`, { method: 'DELETE' }),
};

/**
 * Subscribe to audio job updates via WebSocket.
 * @param {string} jobId
 * @param {function({event, clipId, duration?, src?, error?}): void} onUpdate
 * @returns {function(): void} disconnect function
 */
export function connectAudioWebSocket(jobId, onUpdate) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe_audio', jobId }));
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === 'audio_ready' || data.event === 'audio_error') {
        onUpdate(data);
        ws.close();
      }
    } catch { /* ignore */ }
  };
  ws.onerror = () => onUpdate({ event: 'audio_error', error: 'WebSocket error' });

  return () => ws.close();
}
```

Also add `audio` to the default export at the bottom of the file so existing code can use `import api from '../api.js'`:

The file exports named exports; check the bottom of the file. The existing default export is used as `api.renders`, `api.assets` etc. Add `audio` to it:

Find the default export object (if one exists) or ensure `audio` is accessible. Looking at the file, imports are named — `import api, { connectJobWebSocket } from '../api.js'`. The default export must be added. Add at the bottom of `api.js`:

```js
export default {
  projects,
  assets,
  jobs,
  renders,
  audio,
  checkHealth
};
```

Check if a default export already exists. If it does, add `audio` to it.

- [ ] **Step 2: Verify the default export in api.js already exists**

Read the bottom of `services/web/src/api.js` to confirm. If no default export exists, add the one above. If one exists, add `audio` to it.

- [ ] **Step 3: Commit**

```bash
git add services/web/src/api.js
git commit -m "feat: add audio API methods and connectAudioWebSocket to api.js"
```

---

## Task 6: AudioPanel.vue Component

**Files:**
- Create: `services/web/src/components/inspector/AudioPanel.vue`

- [ ] **Step 1: Create `AudioPanel.vue`**

```vue
<template>
  <div class="audio-panel px-4 py-3 border-t border-studio-border">
    <div class="text-xs font-medium text-studio-text-muted mb-3">Audio</div>

    <!-- Source selector -->
    <div class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Source</label>
      <div class="flex gap-2">
        <button
          v-for="opt in sourceOptions"
          :key="opt.value"
          class="px-2 py-1 text-xs rounded border transition-colors"
          :class="localType === opt.value
            ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
            : 'border-studio-border text-studio-text-muted hover:border-studio-accent/50'"
          @click="localType = opt.value"
        >{{ opt.label }}</button>
      </div>
    </div>

    <!-- File upload -->
    <div v-if="localType === 'file'" class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Audio file</label>
      <div v-if="hasAudio && audio.type === 'file'" class="flex items-center gap-2 text-xs">
        <span class="text-studio-accent">&#10003;</span>
        <span class="text-studio-text truncate">{{ audioFilename }}</span>
        <span class="text-studio-text-muted">{{ formattedDuration }}</span>
      </div>
      <label
        v-else
        class="flex items-center gap-2 px-3 py-2 border border-dashed border-studio-border rounded cursor-pointer hover:border-studio-accent/50 transition-colors"
      >
        <span class="text-xs text-studio-text-muted">Choose file (.mp3, .wav, .ogg)</span>
        <input type="file" accept="audio/*" class="hidden" @change="onFileChange" />
      </label>
    </div>

    <!-- TTS -->
    <div v-if="localType === 'gtts' || localType === 'coqui'" class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Text</label>
      <textarea
        v-model="localText"
        class="input text-xs resize-none w-full"
        rows="3"
        placeholder="Enter text to synthesize..."
      ></textarea>
      <div class="flex items-center gap-2 mt-2">
        <div class="flex-1">
          <label class="block text-xs text-studio-text-muted mb-1">Language</label>
          <select v-model="localLang" class="input text-xs w-full">
            <option v-for="l in langs" :key="l.code" :value="l.code">{{ l.label }}</option>
          </select>
        </div>
        <button
          class="btn btn-primary text-xs mt-4 px-3"
          :disabled="!localText.trim() || ttsLoading"
          @click="generateTTS"
        >
          <span v-if="ttsLoading">&#8987;</span>
          <span v-else>Generate</span>
        </button>
      </div>
      <div v-if="hasAudio && audio.status === 'ready'" class="mt-2 text-xs text-studio-accent">
        &#10003; Ready ({{ formattedDuration }})
      </div>
      <div v-if="hasAudio && audio.status === 'pending'" class="mt-2 text-xs text-studio-text-muted">
        &#8987; Generating...
      </div>
      <div v-if="hasAudio && audio.status === 'error'" class="mt-2 text-xs text-studio-error">
        &#9888; Failed. Try again.
      </div>
    </div>

    <!-- Sync mode -->
    <div v-if="hasAudio" class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Sync</label>
      <div class="flex gap-2">
        <button
          v-for="opt in syncOptions"
          :key="opt.value"
          class="px-2 py-1 text-xs rounded border transition-colors"
          :class="localSyncMode === opt.value
            ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
            : 'border-studio-border text-studio-text-muted hover:border-studio-accent/50'"
          @click="localSyncMode = opt.value; onSyncModeChange()"
        >{{ opt.label }}</button>
      </div>
      <div v-if="localSyncMode === 'manual'" class="mt-2">
        <label class="block text-xs text-studio-text-muted mb-1">Offset (s)</label>
        <input
          type="number"
          v-model.number="localOffset"
          min="0"
          step="0.1"
          class="input text-xs w-24"
          @change="onOffsetChange"
        />
      </div>
    </div>

    <!-- Remove button -->
    <div v-if="hasAudio" class="mt-2">
      <button
        class="text-xs text-studio-error hover:underline"
        @click="removeAudio"
      >Remove audio</button>
    </div>
  </div>
</template>

<script>
import { actions } from '../../store/project.js';
import api, { connectAudioWebSocket } from '../../api.js';

export default {
  name: 'AudioPanel',

  props: {
    clip: { type: Object, required: true }
  },

  data() {
    return {
      localType: this.clip.audio?.type || 'file',
      localText: this.clip.audio?.text || '',
      localLang: this.clip.audio?.lang || 'tr',
      localSyncMode: this.clip.audio?.syncMode || 'auto',
      localOffset: this.clip.audio?.offset || 0,
      ttsLoading: false,
      sourceOptions: [
        { value: 'file', label: 'File' },
        { value: 'gtts', label: 'gTTS' },
        { value: 'coqui', label: 'Coqui' },
      ],
      syncOptions: [
        { value: 'auto', label: 'Auto' },
        { value: 'manual', label: 'Manual' },
      ],
      langs: [
        { code: 'tr', label: 'Turkish' },
        { code: 'en', label: 'English' },
        { code: 'de', label: 'German' },
        { code: 'fr', label: 'French' },
        { code: 'es', label: 'Spanish' },
        { code: 'ja', label: 'Japanese' },
      ],
    };
  },

  computed: {
    audio() { return this.clip.audio; },
    hasAudio() { return !!this.clip.audio; },
    audioFilename() {
      if (!this.audio?.src) return '';
      return this.audio.src.split('/').pop();
    },
    formattedDuration() {
      if (!this.audio?.duration) return '';
      return `${parseFloat(this.audio.duration).toFixed(1)}s`;
    }
  },

  methods: {
    async onFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const result = await api.audio.upload(file, this.clip.id);
        actions.setClipAudio(this.clip.id, {
          type: 'file',
          src: result.src,
          duration: result.duration,
          syncMode: this.localSyncMode,
          offset: this.localOffset,
          status: 'ready'
        });
      } catch (err) {
        console.error('[AudioPanel] Upload failed:', err);
      }
    },

    async generateTTS() {
      if (!this.localText.trim() || this.ttsLoading) return;
      this.ttsLoading = true;
      try {
        actions.setClipAudio(this.clip.id, {
          type: this.localType,
          text: this.localText,
          lang: this.localLang,
          syncMode: this.localSyncMode,
          offset: this.localOffset,
          status: 'pending'
        });

        const { jobId } = await api.audio.tts(
          this.clip.id, this.localType, this.localText, this.localLang
        );

        connectAudioWebSocket(jobId, (data) => {
          if (data.event === 'audio_ready') {
            actions.setClipAudio(this.clip.id, {
              type: this.localType,
              text: this.localText,
              lang: this.localLang,
              syncMode: this.localSyncMode,
              offset: this.localOffset,
              src: data.src,
              duration: data.duration,
              status: 'ready'
            });
          } else {
            actions.setClipAudio(this.clip.id, {
              ...this.clip.audio,
              status: 'error'
            });
          }
          this.ttsLoading = false;
        });
      } catch (err) {
        actions.setClipAudio(this.clip.id, { ...this.clip.audio, status: 'error' });
        this.ttsLoading = false;
      }
    },

    onSyncModeChange() {
      if (!this.hasAudio) return;
      actions.setClipAudio(this.clip.id, { ...this.clip.audio, syncMode: this.localSyncMode });
    },

    onOffsetChange() {
      if (!this.hasAudio) return;
      actions.setClipAudio(this.clip.id, { ...this.clip.audio, offset: this.localOffset });
    },

    removeAudio() {
      actions.removeClipAudio(this.clip.id);
      this.localType = 'file';
      this.localText = '';
      this.ttsLoading = false;
    }
  }
};
</script>
```

- [ ] **Step 2: Commit**

```bash
git add services/web/src/components/inspector/AudioPanel.vue
git commit -m "feat: add AudioPanel.vue inspector component for per-clip audio"
```

---

## Task 7: Inspector.vue — Add Audio Tab

**Files:**
- Modify: `services/web/src/components/inspector/Inspector.vue`

- [ ] **Step 1: Import AudioPanel and add it as a component**

In `Inspector.vue`, add the import:
```js
import AudioPanel from './AudioPanel.vue';
```

Add `AudioPanel` to the `components` object.

- [ ] **Step 2: Add AudioPanel below AnimationPanel in the template**

After `</AnimationPanel>` and before the delete button div, add:

```vue
<!-- Audio Panel (only for clip-level view — when a clip is selected) -->
<AudioPanel
  v-if="selectedClip"
  :clip="selectedClip"
/>
```

- [ ] **Step 3: Add `selectedClip` computed property**

In the `computed` section of `Inspector.vue`, add:

```js
selectedClip() {
  return getters.selectedClip();
},
```

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/inspector/Inspector.vue
git commit -m "feat: add AudioPanel tab to Inspector when clip is selected"
```

---

## Task 8: TimelineBlock.vue — Audio Strip

**Files:**
- Modify: `services/web/src/components/timeline/TimelineBlock.vue`

- [ ] **Step 1: Add audio strip and disable resize for auto-sync clips**

In the `<template>`, after the Resize Handle Right div and before the closing `</div>`, add:

```vue
<!-- Audio strip -->
<div
  v-if="element.audio"
  class="audio-strip absolute left-0 right-0 flex items-center px-1 gap-1"
  style="bottom: -14px; height: 12px; font-size: 9px; pointer-events: none;"
  :class="{
    'text-blue-400': element.audio.status === 'ready',
    'text-slate-400': element.audio.status === 'pending',
    'text-red-400': element.audio.status === 'error',
  }"
>
  <span v-if="element.audio.status === 'ready'">&#9834; {{ audioDuration }}</span>
  <span v-if="element.audio.status === 'pending'">&#8987;</span>
  <span v-if="element.audio.status === 'error'">&#9888;</span>
</div>
```

- [ ] **Step 2: Add `audioDuration` computed property**

In the `computed` section:

```js
audioDuration() {
  if (!this.element.audio?.duration) return '';
  return `${parseFloat(this.element.audio.duration).toFixed(1)}s`;
},
```

- [ ] **Step 3: Disable resize handles when syncMode is auto and audio is ready**

In the Resize Handle Left and Resize Handle Right divs, add a condition so `@mousedown.stop` only fires when resize is allowed:

Replace both resize handle `@mousedown.stop` listeners:
```vue
<!-- Resize Handle Left -->
<div
  class="resize-handle resize-left absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
  :class="{ 'pointer-events-none opacity-0': audioAutoLocked }"
  @mousedown.stop="startResize('left', $event)"
></div>

<!-- Resize Handle Right -->
<div
  class="resize-handle resize-right absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
  :class="{ 'pointer-events-none opacity-0': audioAutoLocked }"
  @mousedown.stop="startResize('right', $event)"
></div>
```

Add `audioAutoLocked` computed:
```js
audioAutoLocked() {
  return this.element.audio?.syncMode === 'auto' && this.element.audio?.status === 'ready';
},
```

- [ ] **Step 4: Commit**

```bash
git add services/web/src/components/timeline/TimelineBlock.vue
git commit -m "feat: add audio status strip to TimelineBlock, lock resize for auto-sync"
```

---

## Task 9: codegen.js VoiceoverScene + Tests (TDD)

**Files:**
- Create: `services/web/tests/components/audio-codegen.test.js`
- Modify: `services/api/src/compiler/codegen.js`
- (manim.js in Task 10)

- [ ] **Step 1: Write failing tests**

Create `services/web/tests/components/audio-codegen.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920, SH = 1080;

function makeObj(id) {
  return {
    id, type: 'circle',
    x: SW / 2, y: SH / 2,
    width: 200, height: 200,
    fill: '#ffffff', stroke: 'transparent', strokeWidth: 2,
    opacity: 1, rotation: 0,
    enterTime: 0, duration: 5,
    enterAnim: 'none', exitAnim: 'none',
  };
}

function makeProject(clips) {
  return {
    name: 'AudioTest',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects: [makeObj('obj1')],
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
  };
}

const readyAudio = (type = 'gtts') => ({
  type, src: '/data/assets/audio/abc123.wav',
  syncMode: 'auto', status: 'ready', duration: 2.5
});

describe('VoiceoverScene base class', () => {
  it('uses Scene when no clips have audio', () => {
    const script = generateManimScript(makeProject([]));
    expect(script).toContain('class MainScene(Scene)');
    expect(script).not.toContain('VoiceoverScene');
  });

  it('uses VoiceoverScene when clip has ready audio', () => {
    const clips = [{ id: 'c1', type: 'move', startTime: 1, duration: 2, sourceId: 'obj1', params: { targetX: SW / 2, targetY: SH / 2 }, easing: 'linear', parallel: false, lag_ratio: 0, audio: readyAudio() }];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('VoiceoverScene');
  });

  it('does NOT use VoiceoverScene for pending audio', () => {
    const clips = [{ id: 'c1', type: 'move', startTime: 1, duration: 2, sourceId: 'obj1', params: { targetX: SW / 2, targetY: SH / 2 }, easing: 'linear', parallel: false, lag_ratio: 0, audio: { type: 'gtts', status: 'pending' } }];
    const script = generateManimScript(makeProject(clips));
    expect(script).not.toContain('VoiceoverScene');
  });
});

describe('voiceover wrapping', () => {
  it('wraps move clip animation in with self.voiceover()', () => {
    const clips = [{ id: 'c1', type: 'move', startTime: 1, duration: 2, sourceId: 'obj1', params: { targetX: SW / 2, targetY: SH / 2 }, easing: 'linear', parallel: false, lag_ratio: 0, audio: readyAudio() }];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('with self.voiceover(audio=');
    expect(script).toContain('/data/assets/audio/abc123.wav');
    expect(script).toContain('self.play(');
  });

  it('auto syncMode appends self.wait(tracker.duration - ...)', () => {
    const clips = [{ id: 'c1', type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: { targetX: SW / 2, targetY: SH / 2 }, easing: 'linear', parallel: false, lag_ratio: 0, audio: readyAudio() }];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('tracker.duration');
  });

  it('manual syncMode with offset prepends self.wait(offset)', () => {
    const clips = [{ id: 'c1', type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: { targetX: SW / 2, targetY: SH / 2 }, easing: 'linear', parallel: false, lag_ratio: 0, audio: { type: 'file', src: '/data/assets/audio/abc123.wav', syncMode: 'manual', offset: 0.5, status: 'ready', duration: 3.0 } }];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('self.wait(0.5)');
    expect(script).not.toContain('tracker.duration');
  });

  it('clip without audio is not wrapped', () => {
    const clips = [{ id: 'c1', type: 'move', startTime: 0, duration: 2, sourceId: 'obj1', params: { targetX: SW / 2, targetY: SH / 2 }, easing: 'linear', parallel: false, lag_ratio: 0 }];
    const script = generateManimScript(makeProject(clips));
    expect(script).not.toContain('with self.voiceover');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/web && npm run test:unit -- audio-codegen.test.js
```

Expected: fail (no VoiceoverScene logic yet).

- [ ] **Step 3: Modify `codegen.js` — VoiceoverScene base class detection**

In `generatePythonCode`, find:
```js
  const sceneBase = project.cameraType === 'moving' ? 'MovingCameraScene' : 'Scene';
```

Replace with:
```js
  const allClips = (project.tracks || []).flatMap(t => t.clips || []);
  const hasReadyAudio = allClips.some(c => c.audio && c.audio.status === 'ready' && c.audio.src);

  let sceneBase;
  if (project.cameraType === 'moving' && hasReadyAudio) {
    sceneBase = 'MovingCameraScene';  // MovingCameraScene + VoiceoverScene combo not supported; camera takes priority
  } else if (hasReadyAudio) {
    sceneBase = 'VoiceoverScene';
  } else {
    sceneBase = project.cameraType === 'moving' ? 'MovingCameraScene' : 'Scene';
  }
```

After `L.push('from manim import *');`, add the voiceover import when needed:
```js
  if (hasReadyAudio) {
    L.push('from manim_voiceover import VoiceoverScene');
    L.push('from manim_voiceover.services.gtts import GTTSService');
  }
```

After `L.push(`class MainScene(${sceneBase}):`);` and `L.push('    def construct(self):');`, add:
```js
  if (hasReadyAudio) {
    L.push('        self.set_speech_service(GTTSService())');
  }
```

- [ ] **Step 4: Modify `codegen.js` — tag clip steps with audio info**

In the clip step emission, find the single-clip branch where `if (code) steps.push(...)`:

For every `steps.push({ time: c.startTime, order: 1, code, dur })` line inside the `cg.type === 'single'` block and the degenerate-single-parallel block, add `audio: c.audio, _clipId: c.id`:

```js
if (code) steps.push({ time: c.startTime, order: 1, code, dur, audio: c.audio, _clipId: c.id });
```

Do this for ALL such push calls in both the `cg.type === 'single'` block and the single-parallel degenerate case.

- [ ] **Step 5: Modify `codegen.js` — wrap steps with audio in voiceover context**

In the "Emit" section, find:
```js
  for (const step of steps) {
    const wait = step.time - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);
    L.push(`${indent}${step.code}`);
    t = step.time + (step.dur || 0.5);
  }
```

Replace with:
```js
  for (const step of steps) {
    const wait = step.time - t;
    if (wait > 0.05) L.push(`${indent}self.wait(${wait.toFixed(1)})`);

    const a = step.audio;
    if (a && a.status === 'ready' && a.src) {
      const trackerId = `_tracker_${(step._clipId || 'x').replace(/[^a-zA-Z0-9]/g, '_')}`;
      L.push(`${indent}with self.voiceover(audio="${a.src}") as ${trackerId}:`);
      if (a.syncMode === 'manual' && a.offset > 0) {
        L.push(`${indent}    self.wait(${parseFloat(a.offset).toFixed(1)})`);
      }
      const innerLines = step.code.split('\n');
      for (const line of innerLines) {
        L.push(`${indent}    ${line.trim()}`);
      }
      if (a.syncMode === 'auto') {
        const dur = parseFloat(step.dur || 1).toFixed(1);
        L.push(`${indent}    self.wait(max(0, ${trackerId}.duration - ${dur}))`);
      }
    } else {
      L.push(`${indent}${step.code}`);
    }

    t = step.time + (step.dur || 0.5);
  }
```

- [ ] **Step 6: Run codegen tests — expect PASS**

```bash
cd services/web && npm run test:unit -- audio-codegen.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 7: Run full suite**

```bash
cd services/web && npm run test:unit && npm test
```

Expected: 54+ unit + 89 engine tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/api/src/compiler/codegen.js services/web/tests/components/audio-codegen.test.js
git commit -m "feat: codegen VoiceoverScene base class and per-clip voiceover wrapping"
```

---

## Task 10: manim.js Mirror

**Files:**
- Modify: `services/web/src/export/manim.js`

- [ ] **Step 1: Apply same changes as Task 9 to `manim.js`**

`manim.js` mirrors `codegen.js` semantics. Apply these three changes:

**Change 1 — base class detection** (find the line that sets `sceneBase`, same pattern as codegen.js):

```js
  const allClips = (project.tracks || []).flatMap(t => t.clips || []);
  const hasReadyAudio = allClips.some(c => c.audio && c.audio.status === 'ready' && c.audio.src);

  let sceneBase;
  if (project.cameraType === 'moving' && hasReadyAudio) {
    sceneBase = 'MovingCameraScene';
  } else if (hasReadyAudio) {
    sceneBase = 'VoiceoverScene';
  } else {
    sceneBase = project.cameraType === 'moving' ? 'MovingCameraScene' : 'Scene';
  }
```

**Change 2 — imports** (after `from manim import *`):

```js
  if (hasReadyAudio) {
    L.push('from manim_voiceover import VoiceoverScene');
    L.push('from manim_voiceover.services.gtts import GTTSService');
  }
```

**Change 3 — set_speech_service** (after `def construct(self):`):

```js
  if (hasReadyAudio) {
    L.push('        self.set_speech_service(GTTSService())');
  }
```

**Change 4 — tag clip steps with audio** (same as codegen.js Task 9 Step 4):

For every clip `steps.push(...)` call, add `audio: c.audio, _clipId: c.id`.

**Change 5 — voiceover wrapping in emit loop** (same code as Task 9 Step 5).

- [ ] **Step 2: Run codegen tests against manim.js (they already test manim.js)**

```bash
cd services/web && npm run test:unit -- audio-codegen.test.js
```

Expected: still all passing (tests use `generateManimScript` from manim.js).

- [ ] **Step 3: Run full suite**

```bash
cd services/web && npm run test:unit && npm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/export/manim.js
git commit -m "feat: mirror VoiceoverScene codegen changes in manim.js"
```

---

## Task 11: Audio Worker Service

**Files:**
- Create: `services/audio/Dockerfile`
- Create: `services/audio/Dockerfile.coqui`
- Create: `services/audio/requirements.txt`
- Create: `services/audio/requirements.coqui.txt`
- Create: `services/audio/worker.py`

- [ ] **Step 1: Create `services/audio/requirements.txt`**

```
redis==5.0.8
gTTS==2.5.1
```

- [ ] **Step 2: Create `services/audio/requirements.coqui.txt`**

```
redis==5.0.8
gTTS==2.5.1
TTS==0.22.0
```

- [ ] **Step 3: Create `services/audio/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .
CMD ["python", "worker.py"]
```

- [ ] **Step 4: Create `services/audio/Dockerfile.coqui`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg espeak-ng && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.coqui.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .
ENV ENABLE_COQUI=1
CMD ["python", "worker.py"]
```

- [ ] **Step 5: Create `services/audio/worker.py`**

```python
"""
Audio Worker — processes gTTS and Coqui TTS jobs from Redis.
Notifies API via HTTP when complete.
"""

import os
import json
import subprocess
import time
import urllib.request

import redis

REDIS_URL  = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATA_DIR   = os.environ.get("DATA_DIR", "/data")
API_URL    = os.environ.get("API_URL", "http://api:3000")
ENABLE_COQUI = os.environ.get("ENABLE_COQUI", "0") == "1"

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

if ENABLE_COQUI:
    from TTS.api import TTS as CoquiTTS
    _coqui = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
    print("[audio] Coqui TTS model loaded")


def audio_dir():
    d = os.path.join(DATA_DIR, "assets", "audio")
    os.makedirs(d, exist_ok=True)
    return d


def mp3_to_wav(mp3_path, wav_path):
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", mp3_path, wav_path],
        capture_output=True, timeout=60
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:500]}")


def get_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path],
        capture_output=True, text=True, timeout=30
    )
    data = json.loads(result.stdout)
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "audio":
            return float(stream.get("duration", 0))
    return 0.0


def process_gtts(job):
    from gtts import gTTS
    d = audio_dir()
    mp3 = os.path.join(d, f"{job['jobId']}.mp3")
    wav = os.path.join(d, f"{job['jobId']}.wav")
    tts = gTTS(text=job["text"], lang=job.get("lang", "tr"))
    tts.save(mp3)
    mp3_to_wav(mp3, wav)
    os.remove(mp3)
    return wav


def process_coqui(job):
    d = audio_dir()
    wav = os.path.join(d, f"{job['jobId']}.wav")
    _coqui.tts_to_file(
        text=job["text"],
        language=job.get("lang", "tr"),
        file_path=wav
    )
    return wav


def notify_api(job_id, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API_URL}/api/audio/{job_id}/complete",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[audio] API notification failed for {job_id}: {e}")


def process_job(job):
    job_id  = job["jobId"]
    clip_id = job["clipId"]
    jtype   = job["type"]

    print(f"[audio] Processing job {job_id}, type={jtype}")
    r.hSet(f"audio:job:{job_id}", "status", "running")

    try:
        if jtype == "gtts":
            wav = process_gtts(job)
        elif jtype == "coqui" and ENABLE_COQUI:
            wav = process_coqui(job)
        else:
            raise RuntimeError(f"Unsupported job type: {jtype}")

        duration = get_duration(wav)
        r.hSet(f"audio:job:{job_id}", mapping={
            "status": "ready",
            "duration": str(duration),
            "outputPath": wav
        })
        notify_api(job_id, {"status": "ready", "clipId": clip_id, "duration": duration})
        print(f"[audio] Job {job_id} done, duration={duration:.2f}s")

    except Exception as e:
        print(f"[audio] Job {job_id} failed: {e}")
        r.hSet(f"audio:job:{job_id}", mapping={"status": "error", "error": str(e)})
        notify_api(job_id, {"status": "error", "clipId": clip_id, "error": str(e)})


def main():
    print(f"[audio] Worker started (coqui={'on' if ENABLE_COQUI else 'off'})")
    print(f"[audio] Redis: {REDIS_URL}, API: {API_URL}")
    os.makedirs(os.path.join(DATA_DIR, "assets", "audio"), exist_ok=True)

    queue_key = "audio:queue:coqui" if ENABLE_COQUI else "audio:queue:gtts"
    print(f"[audio] Listening on {queue_key}")

    while True:
        try:
            item = r.blpop(queue_key, timeout=5)
            if not item:
                continue
            _, raw = item
            job = json.loads(raw)
            process_job(job)
        except Exception as e:
            print(f"[audio] Worker loop error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Commit**

```bash
git add services/audio/
git commit -m "feat: add audio worker service (gTTS + Coqui, Redis queue consumer)"
```

---

## Task 12: docker-compose Audio Service

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add audio init dir and audio service**

In `docker-compose.yml`:

**Update `init` command** to also create the audio dir:
```yaml
    command: >
      sh -c "mkdir -p /data/projects /data/assets /data/assets/audio /data/renders && 
             chmod -R 777 /data && 
             echo 'Data directories initialized'"
```

**Add `audio` service** after `renderer-2`:
```yaml
  audio:
    build: ./services/audio
    environment:
      - DATA_DIR=/data
      - REDIS_URL=redis://redis:6379
      - API_URL=http://api:3000
    volumes:
      - manim_motion_data:/data
    depends_on:
      init:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      api:
        condition: service_healthy
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  audio-coqui:
    build:
      context: ./services/audio
      dockerfile: Dockerfile.coqui
    environment:
      - DATA_DIR=/data
      - REDIS_URL=redis://redis:6379
      - API_URL=http://api:3000
      - ENABLE_COQUI=1
    volumes:
      - manim_motion_data:/data
      - coqui_models:/root/.local/share/tts
    depends_on:
      init:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      api:
        condition: service_healthy
    profiles:
      - coqui
    deploy:
      resources:
        limits:
          memory: 4G
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
```

**Add `coqui_models` to `volumes` section**:
```yaml
volumes:
  manim_motion_data:
  redis_data:
  api_node_modules:
  web_node_modules:
  coqui_models:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add audio + audio-coqui Docker services to docker-compose.yml"
```

---

## Task 13: Renderer — manim-voiceover Support

**Files:**
- Modify: `services/renderer/Dockerfile`
- Modify: `services/renderer/worker.py`

- [ ] **Step 1: Add manim-voiceover to renderer Dockerfile**

In `services/renderer/Dockerfile`, change:
```dockerfile
RUN pip install --no-cache-dir redis==5.0.8 manim-fonts==0.5.0
```
to:
```dockerfile
RUN pip install --no-cache-dir redis==5.0.8 manim-fonts==0.5.0 manim-voiceover[gtts]==0.3.6
```

Note: `manim-voiceover[gtts]` installs the package with the gTTS service extra. The exact version may need adjustment; use the latest compatible with `manimcommunity/manim:stable`.

- [ ] **Step 2: Ensure audio dir is accessible in renderer worker**

In `services/renderer/worker.py`, in the `main()` function, find the line:
```python
    os.makedirs(os.path.join(DATA_DIR, "renders"), exist_ok=True)
```

Add after it:
```python
    os.makedirs(os.path.join(DATA_DIR, "assets", "audio"), exist_ok=True)
```

Also, in `render_job`, before building the manim command, add audio file accessibility check. Find:
```python
    # Build manim command
```

Add before it:
```python
    # Ensure audio assets dir is accessible (manim-voiceover reads from absolute paths in generated code)
    audio_dir = os.path.join(DATA_DIR, "assets", "audio")
    os.makedirs(audio_dir, exist_ok=True)
```

- [ ] **Step 3: Commit**

```bash
git add services/renderer/Dockerfile services/renderer/worker.py
git commit -m "feat: add manim-voiceover to renderer, ensure audio dir accessible"
```

---

## Self-Review

After writing all tasks, checking spec coverage:

| Spec Section | Task |
|---|---|
| 5 Docker services (audio + audio-coqui) | Task 11, 12 |
| Audio job flow (API → Redis → worker → callback → WS) | Tasks 1, 3, 4, 11 |
| Clip `audio` data model | Task 2 |
| syncMode auto updates clip.duration | Task 2 |
| syncMode manual keeps clip.duration | Task 2 |
| File upload → /data/assets/audio | Task 3, 5 |
| gTTS job processing | Task 11 |
| Coqui TTS job (profile) | Task 11, 12 |
| api.js audio methods | Task 5 |
| AudioPanel.vue Inspector "Ses" tab | Task 6 |
| Inspector.vue tab integration | Task 7 |
| Timeline audio strip | Task 8 |
| Render button locked when pending | Task 8 (TimelineBlock lock) — **gap: render button lock not implemented** |
| codegen.js VoiceoverScene | Task 9 |
| manim.js mirror | Task 10 |
| renderer manim-voiceover | Task 13 |
| Unit tests | Tasks 2, 9 |

**Gap found:** Render button lock when `hasPendingAudio()` is true. This belongs in `RenderPanel.vue` or wherever the render button lives.

---

## Task 14: Render Button Lock (Gap Fix)

**Files:**
- Modify: `services/web/src/components/render/VideoPreview.vue` or the render trigger component

- [ ] **Step 1: Find where the render button lives**

Search for the render trigger. In `services/web/src/store/project.js`, look for `renderOnServer` or find the render button in `App.vue` or `Toolbar.vue`.

Run:
```bash
grep -r "renderOnServer\|renderProject\|render.*click\|btn.*render" services/web/src --include="*.vue" -l
```

- [ ] **Step 2: Add pending audio check to render button**

In the render trigger component, import `getters` and disable the render button when `getters.hasPendingAudio()` is true. Add a tooltip or text explaining why:

```vue
<button
  @click="startRender"
  :disabled="renderDisabled"
  class="btn btn-primary"
  :title="pendingAudioMessage"
>
  Render
</button>
```

In `computed`:
```js
pendingAudioBlocked() {
  return getters.hasPendingAudio();
},
pendingAudioMessage() {
  return this.pendingAudioBlocked ? 'Waiting for audio generation to complete...' : '';
},
renderDisabled() {
  return this.pendingAudioBlocked || this.isRendering;
}
```

- [ ] **Step 3: Commit**

```bash
git add <render component file>
git commit -m "feat: lock render button while audio jobs are pending"
```
