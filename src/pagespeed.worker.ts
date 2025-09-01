// src/pagespeed.worker.ts
import { REDIS_ENABLED } from './redisClient.js';

if (!REDIS_ENABLED) {
  console.log('[worker] Redis deshabilitado. Worker no iniciado.');
  process.exit(0);
}

// Carga perezosa para evitar importar bull si no hay Redis
const { default: Bull } = await import('bull');
const queue = new Bull('pagespeed', process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');

// Tip: si usas tipos
type Job = import('bull').Job;

queue.process(async (job: Job) => {
  // tu lógica...
});
console.log('[worker] Worker de pagespeed iniciado y escuchando trabajos...');