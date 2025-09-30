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
    let data = response.data;
    try {
      // Derivar plan de acción sugerido (simple heurística local)
      const headers = (data && typeof data === 'object' && (data as any).headers) || {};
      const findings = Array.isArray((data as any)?.findings) ? (data as any).findings : [];
      const plan: Array<{ id: string; title: string; recommendation: string; severity: string }> = [];
      const push = (id:string,title:string,recommendation:string,severity:string) => {
        if(!plan.find(p=>p.id===id)) plan.push({ id, title, recommendation, severity });
      };
      const want = (name:string) => headers && headers[name] && headers[name].present === true;
      const ensureHeader = (h:string, rec:string, sev='high') => { if(!want(h)) push(`hdr:${h}`, `Configurar ${h}`, rec, sev); };
      ensureHeader('content-security-policy','Definir CSP restrictiva (evitar unsafe-inline).');
      ensureHeader('strict-transport-security','Habilitar HSTS con max-age≥31536000; includeSubDomains; preload.');
      ensureHeader('x-frame-options','Agregar X-Frame-Options DENY para mitigar clickjacking.','medium');
      ensureHeader('x-content-type-options','Agregar X-Content-Type-Options: nosniff.','medium');
      ensureHeader('referrer-policy','Agregar Referrer-Policy para limitar exposición de URLs.','low');
      ensureHeader('permissions-policy','Agregar Permissions-Policy limitando APIs (camera=(), geolocation=(), etc.).','medium');
      // Findings críticos
      for(const f of findings){
        const sev = (f?.severity||'').toString().toLowerCase();
        if(sev.includes('critical') || sev.includes('high')) {
          push(`finding:${f.id||f.rule||f.title}`,(f.title||f.id||'Hallazgo crítico'), f.recommendation||f.message||'Revisar configuración.', 'high');
        }
      }
      if(plan.length){ (data as any).suggestedActionPlan = plan.slice(0,15); }
    } catch {}
    res.status(response.status).json(data);
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
