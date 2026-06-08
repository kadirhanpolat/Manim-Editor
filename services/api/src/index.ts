/**
 * Manim Studio API Server
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';

import projectsRouter from './routes/projects.js';
import assetsRouter from './routes/assets.js';
import rendersRouter from './routes/renders.js';
import jobsRouter from './routes/jobs.js';
import fontsRouter from './routes/fonts.js';
import audioRouter from './routes/audio.js';
import { attachWebSocket } from './ws.js';

// Augment Express Request with our dataDir field (shared across all route files)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      dataDir: string;
    }
  }
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ?? 3000;
const DATA_DIR = process.env.DATA_DIR ?? '/data';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  req.dataDir = DATA_DIR;
  next();
});

app.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.use('/api/projects', projectsRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/renders', rendersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/fonts', fontsRouter);
app.use('/api/audio', audioRouter);

app.use(
  (err: { status?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  }
);

attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[API] Data directory: ${DATA_DIR}`);
});
