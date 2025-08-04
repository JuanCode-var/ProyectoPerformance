// src/pagespeed.worker.js
import 'dotenv/config';
import { auditQueue }  from './queue.js';
import redisClient     from './redisClient.js';
import { runPageSpeed } from './pagespeed.service.js';
import { makeCacheKey } from './cacheKey.js';

auditQueue.process(async (job) => {
  const { url, strategy, categories } = job.data;

  // Clave de caché unificada
  const cacheKey = makeCacheKey({ url, strategy, categories });

  console.log(`[pagespeed.worker] Job ${job.id} – ejecutando PageSpeed para ${url}`);

  // 1 sola corrida de PageSpeed
  const result = await runPageSpeed({ url, strategy, categories });

  // Guardar en Redis (TTL 1 h)
  await redisClient.set(cacheKey, JSON.stringify(result));
  await redisClient.expire(cacheKey, 3600);

  console.log(`[pagespeed.worker] Job ${job.id} completado ➜ cacheKey ${cacheKey}`);
  return result; // Bull almacenará esto como job.returnvalue
});

// Eventos de Bull
auditQueue.on('completed', (job) => {
  console.log(`[pagespeed.worker] Job ${job.id} marcado como completed`);
});
auditQueue.on('failed', (job, err) => {
  console.error(`[pagespeed.worker] Job ${job.id} falló:`, err);
});

console.log('[pagespeed.worker] Worker iniciado y escuchando jobs');
