import { Router } from 'express';
import axios from 'axios';
import { sendDiagnostic as sendAuditDiagnostic } from './send-diagnostic.js';

const router = Router();

const BASE = (process.env.MS_SECURITY_URL || 'http://localhost:3002').replace(/\/+$/, '');
const PROXY_TIMEOUT = Number(process.env.SECURITY_PROXY_TIMEOUT_MS || process.env.SECURITY_TIMEOUT_MS || 60000);

// Proxy seguro al microservicio de seguridad
router.post('/security-analyze', async (req, res) => {
  try {
    const response = await axios.post(`${BASE}/api/analyze`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: PROXY_TIMEOUT,
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

// Enviar diagnóstico de seguridad con PDF (reutiliza send-diagnostic genérico)
router.post('/security/send-diagnostic', async (req, res) => {
  // Simplemente llamamos al mismo handler de /audit/send-diagnostic, que acepta {url, id, email, subject, pdf}
  // Personalizamos el subject si no viene
  if (!req.body?.subject && req.body?.url) {
    req.body.subject = `Diagnóstico de Seguridad: ${req.body.url}`;
  }
  return sendAuditDiagnostic(req as any, res as any);
});

export default router;
