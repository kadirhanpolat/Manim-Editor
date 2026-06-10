/**
 * Renders API Routes
 *
 * Serve rendered video files.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { isSafeSegment } from '../util/paths.js';
import { RENDER_EXTS, isRenderExt, contentTypeFor, isRenderFilename } from '../util/renderFiles.js';
import fs from 'fs/promises';
import path from 'path';
import rateLimit from 'express-rate-limit';

const router = Router();

// Reject unsafe (path-traversal) values in id/filename route params before FS use.
for (const _p of ['projectId', 'filename']) {
  router.param(_p, (_req: Request, res: Response, next: NextFunction, val: string) => {
    if (!isSafeSegment(val)) return void res.status(400).json({ error: 'Invalid path parameter' });
    next();
  });
}

// Rate limiting: max 5 render requests per minute per IP
const renderRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many render requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all render routes
router.use(renderRateLimit);

/**
 * Get the latest render for a project (extension follows the render format).
 * GET /api/renders/:projectId/latest.:ext   (ext ∈ mp4|gif|webm)
 */
router.get('/:projectId/latest.:ext', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ext = req.params['ext'];
    if (!isRenderExt(ext)) return void res.status(400).json({ error: 'Invalid render format' });

    const renderPath = path.join(req.dataDir, 'renders', req.params['projectId'], `latest.${ext}`);

    // Check if file exists
    await fs.access(renderPath);

    // Get file stats for content-length
    const stats = await fs.stat(renderPath);

    // Set headers
    res.setHeader('Content-Type', contentTypeFor(ext));
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests for video seeking
    const range = req.headers['range'];

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunkSize);

      const { createReadStream } = await import('fs');
      const stream = createReadStream(renderPath, { start, end });
      stream.pipe(res);
    } else {
      res.sendFile(renderPath);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return void res.status(404).json({
        error: 'Render not found',
        message: 'No render available for this project. Trigger a render first.',
      });
    }
    next(err);
  }
});

/**
 * List all renders for a project.
 * GET /api/renders/:projectId
 */
router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rendersDir = path.join(req.dataDir, 'renders', req.params['projectId']);

    try {
      await fs.access(rendersDir);
    } catch {
      return void res.json({ renders: [], hasLatest: false, history: [] });
    }

    let latestName: string | null = null;
    let latestStats: import('fs').Stats | null = null;
    for (const ext of RENDER_EXTS) {
      const candidate = path.join(rendersDir, `latest.${ext}`);
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat && (!latestStats || stat.mtimeMs > latestStats.mtimeMs)) {
        latestStats = stat;
        latestName = `latest.${ext}`;
      }
    }
    const hasLatest = latestName !== null;

    const entries = await fs.readdir(rendersDir);
    const historyFiles = entries
      .filter((f) => f.startsWith('render_') && isRenderFilename(f))
      .sort()
      .reverse()
      .slice(0, 5);

    const history = await Promise.all(
      historyFiles.map(async (name) => {
        const fPath = path.join(rendersDir, name);
        const stat = await fs.stat(fPath).catch(() => null);
        return stat
          ? {
              name,
              size: stat.size,
              modifiedAt: stat.mtime,
              url: `/api/renders/${req.params['projectId']}/${name}`,
            }
          : null;
      })
    );

    res.json({
      renders:
        hasLatest && latestStats && latestName
          ? [
              {
                name: latestName,
                size: latestStats.size,
                modifiedAt: latestStats.mtime,
                url: `/api/renders/${req.params['projectId']}/${latestName}`,
              },
            ]
          : [],
      hasLatest,
      history: history.filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Serve a specific history render file.
 * GET /api/renders/:projectId/:filename
 */
router.get('/:projectId/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['projectId'];
    const filename = req.params['filename'];
    if (!isRenderFilename(filename))
      return void res.status(400).json({ error: 'Invalid filename' });

    const filePath = path.join(req.dataDir, 'renders', projectId, filename);
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT')
      return void res.status(404).json({ error: 'File not found' });
    next(err);
  }
});

export default router;
