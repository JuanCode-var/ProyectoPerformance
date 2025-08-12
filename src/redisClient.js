// server/redisClient.js (ESM)
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables desde server/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const url = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url });

redisClient.on('error', (err) => console.error('[redis] Error:', err));
await redisClient.connect();
console.log('[redis] Conectado a', url);

export default redisClient;


