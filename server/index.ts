// src/index.ts
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './database/mongo.js';      // 👈 mantén .js (NodeNext)
import formRoutes from './routes/formRoutes.js';      // 👈 mantén .js (NodeNext)
import securityRoutes from './routes/securityRoutes.js'; // 👈 mantén .js (NodeNext)
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { logRequest, recordVisit } from './controllers/admin.controller.js';

// Evitar que TS incluya archivos fuera de rootDir durante build
// (cargamos dinámicamente en runtime ESM)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const redisMod: any = await (Function('return import("../src/redisClient.js")')());
const { default: redisClient, connectRedisIfEnabled, REDIS_ENABLED } = redisMod;

// 👇 Solo cierre elegante de la cola (carga dinámica)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const queueMod: any = await (Function('return import("../src/queue.js")')());
const { closePagespeedQueue } = queueMod;

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

app.use((req, _res, next) => {
  req.on('aborted', () => {
    console.warn('⚠️ Request aborted by client:', req.method, req.url);
  });
  next();
});

// Simple request log + telemetry for QA
app.use((req, _res, next) => {
  try { logRequest(req.method, req.url); } catch {}
  // Record telemetry for GET HTML routes quickly (filter noisy assets)
  if (req.method === 'GET' && /^\/(admin|historico|security-history|settings|diagnostico|login|register|$)/.test(req.path)) {
    try { recordVisit(req.path, (req as any).user || null); } catch {}
  }
  next();
});

// Rutas
app.use('/api', authRoutes);
app.use('/api', formRoutes);
app.use('/api', securityRoutes);
app.use('/api', adminRoutes);
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
    // Log APP_BASE_URL diagnóstico
    const rawBase = process.env.APP_BASE_URL;
    if (!rawBase) {
      console.warn('[startup] APP_BASE_URL no establecido. Usará http://localhost:5173 en enlaces.');
    } else {
      console.log('[startup] APP_BASE_URL =', rawBase);
      if (/^:?\d{2,5}$/.test(rawBase)) {
        console.warn('[startup] APP_BASE_URL parece solo un puerto. Debe ser algo como http://localhost:' + rawBase.replace(':',''));
      } else if (!/^https?:\/\//i.test(rawBase)) {
        console.warn('[startup] APP_BASE_URL sin protocolo. Ejemplo correcto: http://localhost:5173');
      }
    }
    await Promise.resolve(connectDB());
    await connectRedisIfEnabled();
    console.log(`[startup] Redis: ${REDIS_ENABLED ? 'habilitado' : 'deshabilitado (fallback in-memory)'}`);

    const server = app.listen(PORT, () => {
      console.log(`🚀 Gateway escuchando en http://localhost:${PORT}`);
    });

    // Aumentar timeouts para diagnósticos largos (PSI/Lighthouse)
    server.headersTimeout = 300_000; // antes 120_000
    server.keepAliveTimeout = 300_000; // antes 120_000
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