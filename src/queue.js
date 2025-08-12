import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Queue from 'bull';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga variables del server/.env
dotenv.config({ path: path.join(__dirname, '../server/.env') });

if (!process.env.REDIS_URL) {
  throw new Error('⚠️ Falta REDIS_URL en .env');
}

export const auditQueue = new Queue('auditQueue', process.env.REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 1,
    timeout: 300000 // 5 minutos
  },
  limiter: { max: 2, duration: 1000 },
  settings: { stalledInterval: 30000 }
});

// Helper opcional para encolar con nombre 'run'
export function enqueueRun(data, opts = {}) {
  return auditQueue.add('run', data, opts);
}

