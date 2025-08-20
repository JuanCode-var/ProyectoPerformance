import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './database/mongo.js';      // 👈 mantén .js (NodeNext)
import formRoutes from './routes/formRoutes.js';      // 👈 mantén .js (NodeNext)
import { getDiagnosticsRaw, getDiagnosticsProcessed, getDiagnosticsProcessedById } from "./../server/controllers/FormController.js";
// ajusta la ruta relativa si tu index no está en la misma carpeta


// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Conexión a DB
connectDB();

// Rutas
app.use('/api', formRoutes);

// server/index.ts (server Express)
app.get("/api/diagnostics/:rawUrl", getDiagnosticsRaw as any);
app.get("/api/diagnostics/:rawUrl/processed", getDiagnosticsProcessed as any);
app.get("/api/diagnostics/by-id/:id/processed", getDiagnosticsProcessedById as any);


// Health
app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// Error handler (tipado)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('🚨 Unhandled error:', err);
  res.status(err?.status || 500).json({ error: err?.message || 'Error interno del servidor' });
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Gateway escuchando en http://localhost:${PORT}`);
});

export default app;
