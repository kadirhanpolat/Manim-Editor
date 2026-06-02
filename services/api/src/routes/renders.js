/**
 * Renders API Routes
 * 
 * Serve rendered video files.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting: max 5 render requests per minute per IP
const renderRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many render requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all render routes
router.use(renderRateLimit);

/**
 * Get the latest render for a project.
 * GET /api/renders/:projectId/latest.mp4
 */
router.get('/:projectId/latest.mp4', async (req, res, next) => {
  try {
    const renderPath = path.join(
      req.dataDir,
      'renders',
      req.params.projectId,
      'latest.mp4'
    );
    
    // Check if file exists
    await fs.access(renderPath);
    
    // Get file stats for content-length
    const stats = await fs.stat(renderPath);
    
    // Set headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests for video seeking
    const range = req.headers.range;
    
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
    if (err.code === 'ENOENT') {
      return res.status(404).json({ 
        error: 'Render not found',
        message: 'No render available for this project. Trigger a render first.'
      });
    }
    next(err);
  }
});

/**
 * List all renders for a project.
 * GET /api/renders/:projectId
 */
router.get('/:projectId', async (req, res, next) => {
  try {
    const rendersDir = path.join(req.dataDir, 'renders', req.params.projectId);

    try { await fs.access(rendersDir); } catch {
      return res.json({ renders: [], hasLatest: false, history: [] });
    }

    const latestPath = path.join(rendersDir, 'latest.mp4');
    let hasLatest = false;
    let latestStats = null;
    try { latestStats = await fs.stat(latestPath); hasLatest = true; } catch {}

    const entries = await fs.readdir(rendersDir);
    const historyFiles = entries
      .filter(f => f.startsWith('render_') && f.endsWith('.mp4'))
      .sort()
      .reverse()
      .slice(0, 5);

    const history = await Promise.all(
      historyFiles.map(async (name) => {
        const fPath = path.join(rendersDir, name);
        const stat  = await fs.stat(fPath).catch(() => null);
        return stat ? { name, size: stat.size, modifiedAt: stat.mtime, url: `/api/renders/${req.params.projectId}/${name}` } : null;
      })
    );

    res.json({
      renders: hasLatest ? [{ name: 'latest.mp4', size: latestStats.size, modifiedAt: latestStats.mtime, url: `/api/renders/${req.params.projectId}/latest.mp4` }] : [],
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
router.get('/:projectId/:filename', async (req, res, next) => {
  try {
    const { projectId, filename } = req.params;
    if (!/^[\w.-]+\.mp4$/.test(filename)) return res.status(400).json({ error: 'Invalid filename' });

    const filePath = path.join(req.dataDir, 'renders', projectId, filename);
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    next(err);
  }
});

export default router;
