import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { enqueueAudioJob, getAudioJobStatus, updateAudioJobStatus } from '../queue.js';

const execFileAsync = promisify(execFile);

const router = Router();

const ALLOWED_AUDIO: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

const audioStorage = multer.diskStorage({
  destination: async (req: Request, _file: Express.Multer.File, cb) => {
    const dir = path.join(req.dataDir, 'assets', 'audio');
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o777 });
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = ALLOWED_AUDIO[file.mimetype] ?? 'wav';
    cb(null, `${uuidv4().replace(/-/g, '')}.${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_AUDIO[file.mimetype]) cb(null, true);
    else cb(new Error(`Audio type not allowed: ${file.mimetype}`));
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

/**
 * Upload an audio file.
 * POST /api/audio/upload
 * Body: multipart, field "file"
 */
router.post(
  '/upload',
  audioUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return void res.status(400).json({ error: 'No file uploaded' });

      const filePath = req.file.path;
      let duration = 0;

      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v',
          'quiet',
          '-print_format',
          'json',
          '-show_streams',
          filePath,
        ]);
        const data = JSON.parse(stdout) as {
          streams?: Array<{ codec_type: string; duration?: string }>;
        };
        for (const stream of data.streams ?? []) {
          if (stream.codec_type === 'audio') {
            duration = parseFloat(stream.duration ?? '0');
            break;
          }
        }
      } catch (e) {
        console.error('[audio] ffprobe failed:', (e as Error).message);
      }

      res.status(201).json({
        audioId: path.basename(filePath),
        src: `/data/assets/audio/${path.basename(filePath)}`,
        duration,
        status: 'ready',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Create a TTS audio job.
 * POST /api/audio/tts
 * Body: { clipId, type: 'gtts'|'coqui', text, lang }
 */
router.post('/tts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { clipId?: string; type?: string; text?: string; lang?: string };
    const { clipId, type, text, lang } = body;
    if (!clipId) return void res.status(400).json({ error: 'clipId required' });
    if (!text || !text.trim()) return void res.status(400).json({ error: 'text required' });
    if (!['gtts', 'coqui'].includes(type ?? ''))
      return void res.status(400).json({ error: 'type must be gtts or coqui' });

    const jobId = uuidv4().replace(/-/g, '');
    await enqueueAudioJob({
      jobId,
      clipId,
      type: type as 'gtts' | 'coqui',
      text: text.trim(),
      lang: lang ?? 'tr',
    });

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
router.post('/:jobId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params['jobId'];
    const body = req.body as {
      status?: string;
      clipId?: string;
      duration?: string | number;
      error?: string;
    };
    const { status, clipId, duration, error } = body;

    const updates: Record<string, string | number | null | undefined> = { status };
    if (duration != null) updates['duration'] = duration;
    if (error) updates['error'] = error;
    await updateAudioJobStatus(jobId, updates);

    // Lazy-import broadcastAudioEvent to avoid circular dependency issues during startup
    try {
      const { broadcastAudioEvent } = await import('../ws.js');
      const audioSrc = `/data/assets/audio/${jobId}.wav`;
      broadcastAudioEvent(jobId, {
        event: status === 'ready' ? 'audio_ready' : 'audio_error',
        jobId,
        clipId,
        duration: duration != null ? parseFloat(String(duration)) : undefined,
        src: status === 'ready' ? audioSrc : undefined,
        error: error ?? undefined,
      });
    } catch (e) {
      console.error('[audio] broadcastAudioEvent not available yet:', (e as Error).message);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Get audio job status.
 * GET /api/audio/:jobId/status
 */
router.get('/:jobId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await getAudioJobStatus(req.params['jobId']);
    if (!job) return void res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * Delete an audio file.
 * DELETE /api/audio/:audioId
 */
router.delete('/:audioId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audioId = req.params['audioId'].replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = path.join(req.dataDir, 'assets', 'audio', audioId);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT')
        return void res.status(404).json({ error: 'Audio file not found' });
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
