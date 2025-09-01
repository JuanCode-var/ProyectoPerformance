// src/redisClient.ts
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, type RedisClientType } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables desde server/.env
dotenv.config({ path: `${__dirname}/../server/.env` });

// Habilitar Redis solo si lo pides explícitamente
export const REDIS_ENABLED =
  process.env.REDIS_ENABLED === 'true' ||
  (!!process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '');

let raw: RedisClientType | null = null;

if (REDIS_ENABLED) {
  raw = createClient({
    url: process.env.REDIS_URL, // p.ej. redis://127.0.0.1:6379
    socket: {
      // Evita bucles de reintentos si falla
      reconnectStrategy: () => new Error('Redis deshabilitado o no disponible en este entorno'),
    },
  });
  raw.on('error', (err) => console.error('[redis] Error:', err));
}

// --- Fallback in-memory (simple) con expiración ---
const mem = new Map<string, string>();
const timers = new Map<string, NodeJS.Timeout>();

type KV = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
};

const kv: KV = REDIS_ENABLED && raw
  ? {
      get: (k) => raw!.get(k),
      set: async (k, v) => { await raw!.set(k, v); },
      del: (k) => raw!.del(k),
      expire: async (k, s) => { await raw!.expire(k, s); },
    }
  : {
      async get(k) { return mem.get(k) ?? null; },
      async set(k, v) { mem.set(k, v); },
      async del(k) { const existed = mem.delete(k); if (timers.has(k)) { clearTimeout(timers.get(k)!); timers.delete(k); } return existed ? 1 : 0; },
      async expire(k, s) {
        if (timers.has(k)) clearTimeout(timers.get(k)!);
        timers.set(k, setTimeout(() => {
          mem.delete(k);
          timers.delete(k);
        }, s * 1000));
      },
    };

export async function connectRedisIfEnabled() {
  if (REDIS_ENABLED && raw && !raw.isOpen) {
    await raw.connect();
    console.log('[redis] Conectado a', process.env.REDIS_URL);
  } else {
    console.log('[redis] Deshabilitado (se usa fallback in-memory)');
  }
}

export default kv;