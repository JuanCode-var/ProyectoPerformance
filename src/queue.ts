// src/queue.ts
import { REDIS_ENABLED } from './redisClient.js';

// Tipos: se extraen solo como tipos (no afectan runtime)
export type Job = import('bull').Job;
export type JobOptions = import('bull').JobOptions;
export type QueueType = import('bull').Queue;

// Instancia única perezosa
let pagespeedQueue: QueueType | null = null;

/**
 * Devuelve la cola de pagespeed si Redis está habilitado; en caso contrario, `null`.
 * Usa import dinámico para no cargar `bull`/`ioredis` cuando no hace falta.
 */
export async function getPagespeedQueue(): Promise<QueueType | null> {
  if (!REDIS_ENABLED) return null;
  if (pagespeedQueue) return pagespeedQueue;

  // Carga perezosa de bull (CJS) desde ESM
  const { default: Bull } = await import('bull'); // interop CJS ←→ ESM
  pagespeedQueue = new Bull('pagespeed', process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');

  return pagespeedQueue;
}

/**
 * Cierre opcional y elegante de la cola (p. ej. en SIGINT/SIGTERM).
 */
export async function closePagespeedQueue(): Promise<void> {
  if (pagespeedQueue) {
    try {
      await pagespeedQueue.close();
    } catch (e) {
      console.warn('[queue] Error al cerrar pagespeedQueue:', (e as Error).message);
    } finally {
      pagespeedQueue = null;
    }
  }
}
// Al final de src/queue.ts
export { getPagespeedQueue as auditQueue };
