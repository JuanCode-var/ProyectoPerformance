import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { runPageSpeed } from './pagespeed.service.js';

const logger =
  process.env.NODE_ENV === 'production'
    ? pino()
    : pino(pino.transport({ target: 'pino-pretty', options: { colorize: true } }));

const app = express();
app.use(cors());
app.use(express.json());

/* ——— POST /audit ——————————————————————————————————— */
app.post(['/audit', '/audit/'], async (req, res) => {
  logger.info('[microPagespeed] body %o', req.body);
  const { url, strategy = 'mobile', categories = ['performance'] } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const data = await runPageSpeed({ url, strategy, categories });
    res.json(data);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: 'Internal error', detail: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => logger.info(`🚀 microPagespeed listening on :${PORT}`));

