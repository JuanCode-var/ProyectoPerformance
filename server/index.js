// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './database/mongo.js';
import formRoutes from './routes/formRoutes.js';

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Conexión a DB
connectDB();

// Rutas
app.use('/api', formRoutes);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Gateway escuchando en http://localhost:${PORT}`);
});