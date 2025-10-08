// src/queue.ts
import { REDIS_ENABLED } from './redisClient.js';
// Instancia única perezosa
let pagespeedQueue = null;
/**
 * Devuelve la cola de pagespeed si Redis está habilitado; en caso contrario, `null`.
 * Usa import dinámico para no cargar `bull`/`ioredis` cuando no hace falta.
 */
export async function getPagespeedQueue() {
    if (!REDIS_ENABLED)
        return null;
    if (pagespeedQueue)
        return pagespeedQueue;
    // Carga perezosa de bull (CJS) desde ESM
    const { default: Bull } = await import('bull'); // interop CJS ←→ ESM
    pagespeedQueue = new Bull('pagespeed', process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    return pagespeedQueue;
}
/**
 * Cierre opcional y elegante de la cola (p. ej. en SIGINT/SIGTERM).
 */
export async function closePagespeedQueue() {
    if (pagespeedQueue) {
        try {
            await pagespeedQueue.close();
        }
        catch (e) {
            console.warn('[queue] Error al cerrar pagespeedQueue:', e.message);
        }
        finally {
            pagespeedQueue = null;
        }
    }
}
