// src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';

import redisClient from './redisClient.js';
import { auditQueue } from './queue.js';
import { makeCacheKey } from './cacheKey.js';


const app    = express();
const logger = pino({ transport: { target: 'pino-pretty' } });

app.use(cors());
app.use(express.json());

app.post('/audit', async (req, res) => {
  try {
    const { url, strategy = 'mobile', categories = ['performance'] } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const cacheKey = makeCacheKey({ url, strategy, categories });
    const cached   = await redisClient.get(cacheKey);
    if (cached) {
      logger.info(`[microPagespeed] Cache hit ➜ ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }

    // Encolar job
    const job = await auditQueue.add({ url, strategy, categories });
    logger.info(`[microPagespeed] Enqueued job ${job.id} for ${url}`);
    return res.status(202).json({ jobId: job.id });
  } catch (e) {
    logger.error('[microPagespeed] ERROR in POST /audit', e);
    return res.status(500).json({ error: 'Internal error', detail: e.message });
  }
});

app.get('/audit/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await auditQueue.getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const state = await job.getState();
    if (state === 'completed') {
      const cacheKey = makeCacheKey(job.data);
      const cached = await redisClient.get(cacheKey);
      return res.json({ status: 'completed', result: JSON.parse(cached) });
    }
    if (state === 'failed') {
      return res.json({ status: 'failed', error: job.failedReason });
    }
    return res.json({ status: state });
  } catch (e) {
    logger.error('[microPagespeed] ERROR in GET /audit/:jobId', e);
    return res.status(500).json({ error: 'Internal error', detail: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🚀 microPagespeed listening on :${PORT}`);
});