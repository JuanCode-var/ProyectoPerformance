// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './database/mongo.js';
import formRoutes from './routes/formRoutes.js';

// ────────────────────────────────────────────────────────────
// Utilidades para __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// ────────────────────────────────────────────────────────────

// 1) Conexión a MongoDB
await connectDB();

// 2) Instancia de Express
const app  = express();
const PORT = process.env.PORT || 4000;

// 3) Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4) Rutas de la API
app.use('/api', formRoutes);

// 5) Ruta de salud
app.get('/', (_req, res) => res.send('Backend en línea'));

// 6) Archivos estáticos del front (opcional)
app.use(
  '/static',
  express.static(path.join(__dirname, '../client/public')),
);

// 7) Levantar servidor
app.listen(PORT, () => {
  console.log(`🚀 Gateway escuchando en http://localhost:${PORT}`);
});
