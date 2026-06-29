/**
 * Jobs API Routes
 *
 * Query render job status.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { isSafeSegment } from '../util/paths.js';
import { cancelRenderJob, getJobStatus, getRenderQueueStats } from '../queue.js';

const router = Router();

// Reject unsafe (path-traversal) values in id/filename route params before FS use.
for (const _p of ['jobId']) {
  router.param(_p, (_req: Request, res: Response, next: NextFunction, val: string) => {
    if (!isSafeSegment(val)) return void res.status(400).json({ error: 'Invalid path parameter' });
    next();
  });
}

/**
 * Get render queue stats.
 * GET /api/jobs/render-queue
 */
router.get('/render-queue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getRenderQueueStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * Get job status.
 * GET /api/jobs/:jobId
 */
router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await getJobStatus(req.params['jobId']);

    if (!job) {
      return void res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: req.params['jobId'],
      ...job,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Cancel a render job.
 * POST /api/jobs/:jobId/cancel
 */
router.post('/:jobId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cancelRenderJob(req.params['jobId']);
    if (result.status === 'not_found') {
      return void res.status(404).json({ error: 'Job not found' });
    }
    if (result.status === 'finished') {
      return void res.status(409).json({ error: 'Job is already finished' });
    }
    return void res.json({
      jobId: result.jobId,
      status: result.status,
      removedFromQueue: result.removedFromQueue,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
