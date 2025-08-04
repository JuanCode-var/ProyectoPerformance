// microUnlighthouse/src/index.js
import express from 'express';
import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { createWriteStream } from 'fs';

dotenv.config();

const PORT = process.env.PORT || 3002;
const app = express();
app.use(express.json());

// Logger a fichero + consola
const logStream = createWriteStream('./unlighthouse_ms.log', { flags: 'a' });
function log(msg) {
  const stamp = `[${new Date().toISOString()}] `;
  logStream.write(stamp + msg + '\n');
  console.log(stamp + msg);
}

// Health check
app.get('/', (_req, res) => res.send('MS-Unlighthouse activo — POST /audit'));

app.post('/audit', async (req, res) => {
  const { url } = req.body;
  log(`POST /audit recibido con URL: ${url}`);

  if (!url) {
    log('❌ Falta URL en body');
    return res.status(400).json({ error: 'Falta url' });
  }

  // Fichero temporal para el JSON
  const tmpFile = path.resolve(`unlighthouse_result_${Date.now()}.json`);

  try {
    log('🔦 Ejecutando Unlighthouse CLI (raíz únicamente)...');

    await execa('npx', [
      'unlighthouse',
      `--site=${url}`,
      '--ci',
      '--headless',
      '--no-dashboard',
      '--no-open',
      '--reporter=json',
      '--output-path', tmpFile,
      '--urls=/'
    ]);

    log(`📄 Leyendo resultado en ${tmpFile}`);
    const raw = await fs.readFile(tmpFile, 'utf-8');
    const json = JSON.parse(raw);
    await fs.unlink(tmpFile);

    // Normaliza métricas
    const summary = json.summary || {};
    const rawMetrics = summary.metrics || {};
    const metrics = {};
    for (const [id, val] of Object.entries(rawMetrics)) {
      metrics[id] = typeof val === 'number' ? val : val.value;
    }

    let performance = null;
    if (summary.categoryScores && typeof summary.categoryScores.performance === 'number') {
      performance = summary.categoryScores.performance;
    }

    const response = {
      type: 'unlighthouse',
      url,
      fetchedAt: new Date().toISOString(),
      metrics,
      performance,
      categoryScores: summary.categoryScores || {}
    };

    log('✅ Unlighthouse completado, devolviendo JSON');
    return res.json(response);
  } catch (err) {
    log('❌ MS-Unlighthouse error: ' + (err.message || err));
    return res.status(500).json({
      type: 'unlighthouse',
      error: err.message,
      detail: err.stderr || err.stack || ''
    });
  }
});

app.listen(PORT, () => {
  log(`🚀 MS-Unlighthouse escuchando en puerto ${PORT}`);
});
