/**
 * Jobs API Routes
 *
 * Query render job status.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { isSafeSegment } from '../util/paths.js';
import { getJobStatus } from '../queue.js';

const router = Router();

// Reject unsafe (path-traversal) values in id/filename route params before FS use.
for (const _p of ['jobId']) {
  router.param(_p, (_req: Request, res: Response, next: NextFunction, val: string) => {
    if (!isSafeSegment(val)) return void res.status(400).json({ error: 'Invalid path parameter' });
    next();
  });
}

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

export default router;
