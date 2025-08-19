// /src/index.ts
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import pino, { type Logger } from 'pino';

import redisClient from './redisClient.js';
import { auditQueue } from './queue.js';
import { makeCacheKey } from './cacheKey.js';

const app = express();
const logger: Logger = pino({ transport: { target: 'pino-pretty' } });

app.use(cors());
app.use(express.json());

app.post('/audit', async (req: Request, res: Response) => {
  try {
    const { url, strategy = 'mobile', categories = ['performance'] } = req.body as {
      url?: string;
      strategy?: 'mobile' | 'desktop' | (string & {});
      categories?: string[];
    };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const cacheKey = makeCacheKey({ url, strategy, categories });
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info(`[microPagespeed] Cache hit ➜ ${cacheKey}`);
      try {
        return res.json(JSON.parse(cached));
      } catch {
        // si el cache estuviera corrupto, seguimos a encolar
      }
    }

    const job = await auditQueue.add({ url, strategy, categories });
    logger.info(`[microPagespeed] Enqueued job ${job.id} for ${url}`);
    return res.status(202).json({ jobId: job.id });
  } catch (e: any) {
    logger.error({ err: e }, '[microPagespeed] ERROR in POST /audit');
    return res.status(500).json({ error: 'Internal error', detail: e?.message || String(e) });
  }
});

app.get('/audit/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params as { jobId: string };
    const job = await auditQueue.getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const state = await job.getState(); // 'completed' | 'failed' | ...
    if (state === 'completed') {
      const cacheKey = makeCacheKey(job.data);
      const cached = await redisClient.get(cacheKey);
      const result = cached ? JSON.parse(cached) : undefined;
      return res.json({ status: 'completed', result });
    }
    if (state === 'failed') {
      return res.json({ status: 'failed', error: job.failedReason });
    }
    return res.json({ status: state });
  } catch (e: any) {
    logger.error({ err: e }, '[microPagespeed] ERROR in GET /audit/:jobId');
    return res.status(500).json({ error: 'Internal error', detail: e?.message || String(e) });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  logger.info(`🚀 microPagespeed listening on :${PORT}`);
});

export default app;