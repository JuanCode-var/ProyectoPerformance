// src/index.ts
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './database/mongo.js';      // 👈 mantén .js (NodeNext)
import formRoutes from './routes/formRoutes.js';      // 👈 mantén .js (NodeNext)

import redisClient, {
  connectRedisIfEnabled,
  REDIS_ENABLED,
} from './../src/redisClient.js'; // 👈 mantén .js (NodeNext)

// 👇 Solo cierre elegante de la cola
import { closePagespeedQueue } from './../src/queue.js'; // 👈 mantén .js (NodeNext)

import {
  getDiagnosticsRaw,
  getDiagnosticsProcessed,
  getDiagnosticsProcessedById,
  getDiagnosticsAudit,
  getAuditByUrl,
} from './../server/controllers/FormController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use((req, _res, next) => {
  req.on('aborted', () => {
    console.warn('⚠️ Request aborted by client:', req.method, req.url);
  });
  next();
});

// Rutas
app.use('/api', formRoutes);
app.get('/api/diagnostics/:rawUrl',               getDiagnosticsRaw as any);
app.get('/api/diagnostics/:rawUrl/processed',     getDiagnosticsProcessed as any);
app.get('/api/diagnostics/by-id/:id/processed',   getDiagnosticsProcessedById as any);
app.get('/api/diagnostics/:rawUrl/audit',         getDiagnosticsAudit as any);
app.get('/api/audit/by-url',                      getAuditByUrl as any);

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'request.aborted' || err?.code === 'ECONNABORTED') {
    if (!res.headersSent) {
      res.status(499).json({
        error: 'Solicitud abortada por el cliente',
        detail: { expected: err?.expected, received: err?.received },
      });
    }
    console.warn(
      '⚠️ Client aborted upload. expected=%s received=%s',
      err?.expected ?? '-', err?.received ?? '-',
    );
    return;
  }
  console.error('🚨 Unhandled error:', err);
  res.status(err?.status || 500).json({ error: err?.message || 'Error interno del servidor' });
});

async function bootstrap() {
  try {
    await Promise.resolve(connectDB());
    await connectRedisIfEnabled();
    console.log(`[startup] Redis: ${REDIS_ENABLED ? 'habilitado' : 'deshabilitado (fallback in-memory)'}`);

    const server = app.listen(PORT, () => {
      console.log(`🚀 Gateway escuchando en http://localhost:${PORT}`);
    });

    server.headersTimeout = 120_000;
    server.keepAliveTimeout = 120_000;
    (server as any).requestTimeout = 0;

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor...`);
      try {
        await closePagespeedQueue();
      } catch (e) {
        console.warn('[shutdown] Problema cerrando cola:', (e as Error).message);
      }
      server.close(() => {
        console.log('✅ Servidor cerrado.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (err) {
    console.error('❌ Error al iniciar la app:', err);
    process.exit(1);
  }
}

void bootstrap();

export default app;