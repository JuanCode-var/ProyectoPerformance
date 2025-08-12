// src/pagespeed.worker.js
import 'dotenv/config';
import { auditQueue } from './queue.js';
import redisClient from './redisClient.js';
// src/pagespeed.worker.js
import { runPageSpeed } from '../microPagespeed/src/pagespeed.service.js';
import { makeCacheKey } from './cacheKey.js';

auditQueue.process('run', 1, async (job) => {
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



 

