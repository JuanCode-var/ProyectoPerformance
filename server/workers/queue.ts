// ...existing code from src/queue.ts...
// Archivo movido desde src/ a server/workers/

import { REDIS_ENABLED } from './redisClient';
export type Job = import('bull').Job;
export type JobOptions = import('bull').JobOptions;
export type QueueType = import('bull').Queue;
let pagespeedQueue: QueueType | null = null;
export async function auditQueue(): Promise<QueueType | null> {
  if (!REDIS_ENABLED) return null;
  if (pagespeedQueue) return pagespeedQueue;
  const { default: Bull } = await import('bull');
  pagespeedQueue = new Bull('pagespeed', process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
  return pagespeedQueue;
}
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
