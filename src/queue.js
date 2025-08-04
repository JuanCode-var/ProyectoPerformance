// src/queue.js
import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error('⚠️  REDIS_URL not defined in .env');
}

// Creamos la cola de auditorías
export const auditQueue = new Queue('auditQueue', {
  redis: {
    url: process.env.REDIS_URL
  }
});

// Opciones de la cola: podrías configurar aquí retry, backoff, etc.
// Ejemplo:
// auditQueue.on('failed', (job, err) => {
//   console.error(`Job failed ${job.id}`, err);
// });

console.log('[queue] Conectada la cola de auditorías a Redis');
