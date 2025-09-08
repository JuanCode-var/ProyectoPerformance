import { Router } from 'express';
import axios from 'axios';

const router = Router();

const BASE = (process.env.MS_SECURITY_URL || 'http://localhost:3002').replace(/\/+$/, '');

// Proxy seguro al microservicio de seguridad
router.post('/security-analyze', async (req, res) => {
  try {
    const response = await axios.post(`${BASE}/api/analyze`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });
    res.status(response.status).json(response.data);
  } catch (err: any) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ error: 'Error al conectar con el microservicio de seguridad', details: String(err?.message || err) });
    }
  }
});

export default router;
