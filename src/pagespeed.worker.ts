// src/pagespeed.worker.ts
import 'dotenv/config';
import { auditQueue, type AuditJobData } from './queue.js';           // NodeNext: deja .js
import redisClient from './redisClient.js';                           // NodeNext: deja .js
import { makeCacheKey } from './cacheKey.js';                         // Usa el .d.ts que hicimos

// Si tu servicio es JS, importa con .js; tipamos mínimo la firma:
type RunPageSpeedArgs = {
  url: string;
  strategy?: 'mobile' | 'desktop' | (string & {});
  categories?: string[];
  // si tu servicio acepta más campos (p. ej. key), añádelos aquí:
  // key?: string;
};
// Import real del servicio JS:
import { runPageSpeed as runPageSpeedFn } from './../microPagespeed/src/pagespeed.service.js';
const runPageSpeed = runPageSpeedFn as (args: RunPageSpeedArgs) => Promise<unknown>;

import type { Job } from 'bull';

auditQueue.process('run', 1, async (job: Job<AuditJobData>) => {
  const { url, strategy, categories } = job.data;
  const cacheKey = makeCacheKey({ url, strategy, categories });
  console.log(`[worker] Job ${job.id} ('run') ejecutando -> ${url}`);

  try {
    const result = await runPageSpeed({ url, strategy, categories });

    await redisClient.set(cacheKey, JSON.stringify(result));
    await redisClient.expire(cacheKey, 3600); // 1h

    // Limpia la marca "en vuelo"
    await redisClient.del(`inflight:${cacheKey}`);

    console.log(`[worker] Job ${job.id} completado -> ${cacheKey}`);
    return result;
  } catch (err) {
    console.error(`[worker] Job ${job.id} falló:`, err);
    // También limpia inflight para permitir reintentos
    await redisClient.del(`inflight:${cacheKey}`);
    throw err;
  }
});
