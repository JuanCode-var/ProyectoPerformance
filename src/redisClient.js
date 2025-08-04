// Crea y conecta un cliente Redis (usa top-level await porque tu package.json es "type": "module").
//Exporta redisClient para que lo reutilicemos en la cola y en el worker.

import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('⚠️  Debes definir Redis URL en .env como REDIS_URL');
}

const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
  console.error('[redisClient] Error de conexión:', err);
});

await redisClient.connect();
console.log('[redisClient] Conectado a Redis');

export default redisClient;
