/**
 * Jobs API Routes
 *
 * Query render job status.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getJobStatus } from '../queue.js';

const router = Router();

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
