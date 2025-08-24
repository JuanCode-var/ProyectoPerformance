import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './database/mongo.js';      // 👈 mantén .js (NodeNext)
import formRoutes from './routes/formRoutes.js';      // 👈 mantén .js (NodeNext)

import {
  getDiagnosticsRaw,
  getDiagnosticsProcessed,
  getDiagnosticsProcessedById,
  getDiagnosticsAudit,   // NUEVO
  getAuditByUrl,         // NUEVO
} from "./../server/controllers/FormController.js";

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Middlewares
app.use(cors());

// ⚙️ Body parsers con límites amplios para PDF base64
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// (Opcional) log suave cuando el cliente aborta la request (útil para PDFs cancelados)
app.use((req, _res, next) => {
  req.on('aborted', () => {
    console.warn('⚠️ Request aborted by client:', req.method, req.url);
  });
  next();
});

// Conexión a DB
connectDB();

// Rutas base (POST /api/audit, GET /api/audit/:id, etc.)
app.use('/api', formRoutes);

// ------- Rutas Diagnostics (lectura directa) -------
app.get("/api/diagnostics/:rawUrl",               getDiagnosticsRaw as any);
app.get("/api/diagnostics/:rawUrl/processed",     getDiagnosticsProcessed as any);
app.get("/api/diagnostics/by-id/:id/processed",   getDiagnosticsProcessedById as any);

// ------- Fallbacks por estrategia -------
app.get("/api/diagnostics/:rawUrl/audit",         getDiagnosticsAudit as any);
app.get("/api/audit/by-url",                      getAuditByUrl as any);

// Health
app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// Error handler (tipado) — maneja 'request.aborted' sin petar logs
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'request.aborted' || err?.code === 'ECONNABORTED') {
    // 499 = Client Closed Request (nginx style)
    if (!res.headersSent) res.status(499).json({
      error: 'Solicitud abortada por el cliente',
      detail: { expected: err?.expected, received: err?.received }
    });
    console.warn('⚠️ Client aborted upload. expected=%s received=%s',
      err?.expected ?? '-', err?.received ?? '-');
    return;
  }
  console.error('🚨 Unhandled error:', err);
  res.status(err?.status || 500).json({ error: err?.message || 'Error interno del servidor' });
});

// Start + timeouts más holgados
const server = app.listen(PORT, () => {
  console.log(`🚀 Gateway escuchando en http://localhost:${PORT}`);
});

// ⏱️ Ajustes de tiempo para cargas grandes / conexiones lentas
server.headersTimeout = 120_000;   // 120s para headers
server.keepAliveTimeout = 120_000; // 120s conexiones keep-alive
// 0 = sin límite (por si tu PDF grande o Lighthouse local tarda)
(server as any).requestTimeout = 0;

export default app;
