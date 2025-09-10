// src/redisClient.ts
// El servidor ya carga las variables con `import 'dotenv/config'`.
// Evitamos depender de `dotenv` ni de `redis` estáticos aquí para que el contenedor del API no falle
// cuando REDIS está deshabilitado o cuando no existen esas deps fuera de /server/node_modules.

// Habilitar Redis solo si lo pides explícitamente
export const REDIS_ENABLED =
  process.env.REDIS_ENABLED === 'true' ||
  (!!process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '');

// Cliente Redis (se crea bajo demanda)
let raw: any = null;

// --- Fallback in-memory (simple) con expiración ---
const mem = new Map<string, string>();
const timers = new Map<string, NodeJS.Timeout>();

type KV = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
};

const kv: KV = {
  async get(k) {
    if (REDIS_ENABLED && raw) return raw.get(k);
    return mem.get(k) ?? null;
  },
  async set(k, v) {
    if (REDIS_ENABLED && raw) { await raw.set(k, v); return; }
    mem.set(k, v);
  },
  async del(k) {
    if (REDIS_ENABLED && raw) return raw.del(k);
    const existed = mem.delete(k);
    if (timers.has(k)) { clearTimeout(timers.get(k)!); timers.delete(k); }
    return existed ? 1 : 0;
  },
  async expire(k, s) {
    if (REDIS_ENABLED && raw) { await raw.expire(k, s); return; }
    if (timers.has(k)) clearTimeout(timers.get(k)!);
    timers.set(k, setTimeout(() => {
      mem.delete(k);
      timers.delete(k);
    }, s * 1000));
  },
};

export async function connectRedisIfEnabled() {
  if (!REDIS_ENABLED) {
    console.log('[redis] Deshabilitado (se usa fallback in-memory)');
    return;
  }
  if (raw && raw.isOpen) {
    console.log('[redis] Ya conectado');
    return;
  }
  // Carga dinámica para no requerir la dependencia si no se usa
  const { createClient } = await import('redis');
  raw = createClient({
    url: process.env.REDIS_URL, // p.ej. redis://127.0.0.1:6379
    socket: {
      reconnectStrategy: () => new Error('Redis deshabilitado o no disponible en este entorno'),
    },
  });
  raw.on('error', (err: any) => console.error('[redis] Error:', err));
  await raw.connect();
  console.log('[redis] Conectado a', process.env.REDIS_URL);
}

export default kv;