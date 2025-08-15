import axios from 'axios';
import nodemailer from 'nodemailer';
import Audit from '../database/esquemaBD.js';
import { readMetrics, extractOpportunities } from '../../src/utils/lh.js'; // ← ruta correcta

// -------- Ping/Info --------
// GET /api/audit  -> responde OK y lista de endpoints (evita 500/404 en GET simples)
export async function auditPing(_req, res) {
  return res.json({
    ok: true,
    message: 'Audit API ready',
    endpoints: [
      'POST /api/audit',
      'GET  /api/audit/:id',
      'GET  /api/audit/history?url=...',
      'POST /api/audit/send-diagnostic',
      'POST /api/audit/send-report'
    ]
  });
}

// Normaliza endpoint: termina en /audit
function withAudit(base) {
  if (!base) return '/audit';
  const trimmed = String(base).replace(/\/+$/, '');
  return trimmed.endsWith('/audit') ? trimmed : `${trimmed}/audit`;
}

// -------- Crear auditoría --------
// POST /api/audit  -> ejecuta microservicio(s) y guarda doc sin reventar
export async function guardarDatos(req, res) {
  // Envoltorio para responder SIEMPRE JSON, incluso si algo truena
  const fail = (status, msg, extra = {}) =>
    res.status(status).json({ ok: false, error: msg, ...extra });

  try {
    const { url, type = 'pagespeed', strategy = 'mobile', name, email, nocache } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return fail(400, 'URL inválida');
    }

    // Config de microservicios
    const MS_PAGESPEED_URL    = process.env.MS_PAGESPEED_URL    || 'http://localhost:3001';
    const MS_UNLIGHTHOUSE_URL = process.env.MS_UNLIGHTHOUSE_URL || 'http://localhost:3002';

    const withAudit = (base) => {
      if (!base) return '/audit';
      const trimmed = String(base).replace(/\/+$/, '');
      return trimmed.endsWith('/audit') ? trimmed : `${trimmed}/audit`;
    };

    const MICROSERVICES = {
      pagespeed:    { endpoint: withAudit(MS_PAGESPEED_URL) },
      unlighthouse: { endpoint: withAudit(MS_UNLIGHTHOUSE_URL) },
    };

    const tipos = Array.isArray(type) ? type : (type === 'all' ? Object.keys(MICROSERVICES) : [type]);
    const invalid = tipos.filter(t => !MICROSERVICES[t]);
    if (invalid.length) return fail(400, `Tipo(s) inválido(s): ${invalid.join(', ')}`);

    // Cache 1h
    try {
      const CACHE_TTL = 1000 * 60 * 60;
      const cutoff = new Date(Date.now() - CACHE_TTL);
      const cached = await Audit.findOne({ url, tipos, strategy, fecha: { $gte: cutoff } });
      if (!nocache && cached) {
        const resp = cached.toObject();
        resp.ok = true;
        resp.isLocal = resp?.audit?.pagespeed?.meta?.source === 'local';
        return res.json(resp);
      }
    } catch (e) {
      // Si la DB está caída, seguimos con auditoría sin cache (no rompemos)
      console.warn('⚠️ Cache lookup falló:', e?.message);
    }

    // Llamadas a microservicios (cada una aislada para no romper)
    const serviceCall = async (t) => {
      const endpoint = MICROSERVICES[t].endpoint;
      const payload  = (t === 'unlighthouse') ? { url } : { url, strategy };
      try {
        const r = await axios.post(endpoint, payload, { timeout: 300000 });
        return { [t]: r.data };
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.code || err?.message || 'error';
        const status = err?.response?.status ?? null;
        return { [t]: { error: msg, status } };
      }
    };

    const partials = await Promise.all(tipos.map(serviceCall));
    const audit = partials.reduce((acc, cur) => ({ ...acc, ...cur }), {});

    // Si todas fallaron, devolvemos 502 pero en JSON, NO reventamos
    const allFailed = tipos.every(t => audit[t] && audit[t].error);
    if (allFailed) {
      return fail(502, 'Ningún microservicio respondió correctamente', { details: audit });
    }

    // Derivación de performance si solo pagespeed y vino ok
    const onlyPagespeedOk = (tipos.length === 1) && audit.pagespeed && !audit.pagespeed.error;
    const perfResolved =
      (onlyPagespeedOk && typeof audit.pagespeed?.performance === 'number' && !Number.isNaN(audit.pagespeed.performance))
        ? Math.round(audit.pagespeed.performance)
        : (onlyPagespeedOk && audit.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score != null
            ? Math.round(audit.pagespeed.raw.lighthouseResult.categories.performance.score * 100)
            : undefined);

    // Guardar en DB (si la DB falla, igual devolvemos el resultado de auditoría)
    let docObj = null;
    try {
      const doc = await Audit.create({
        url,
        type: tipos[0],
        tipos,
        name,
        email,
        strategy,
        audit,
        performance: onlyPagespeedOk ? perfResolved : undefined,
        metrics:     onlyPagespeedOk ? audit.pagespeed?.metrics : undefined,
        fecha:       new Date(),
      });
      docObj = doc.toObject();
    } catch (e) {
      console.error('❌ Error guardando en DB:', e?.message);
      // Devolvemos el resultado sin persistir, para no romper UX
      return res.status(200).json({
        ok: true,
        persisted: false,
        url, strategy, name, email,
        audit,
        performance: onlyPagespeedOk ? perfResolved : undefined,
        metrics:     onlyPagespeedOk ? audit.pagespeed?.metrics : undefined,
        fecha: new Date().toISOString()
      });
    }

    docObj.ok = true;
    docObj.isLocal = docObj?.audit?.pagespeed?.meta?.source === 'local';
    return res.status(201).json(docObj);

  } catch (e) {
    console.error('❌ Error inesperado en /api/audit:', e);
    return fail(500, 'Error al procesar la auditoría', { detail: e?.message });
  }
}


// -------- Obtener auditoría por ID --------
// GET /api/audit/:id
export async function getAuditById(req, res) {
  try {
    const id = (req.params?.id || '').trim();
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) return res.status(400).json({ error: 'ID inválido' });

    const doc = await Audit.findById(id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const out = doc.toObject();
    out.isLocal = out?.audit?.pagespeed?.meta?.source === 'local';
    return res.json(out);
  } catch (e) {
    console.error('❌ Error en getAuditById:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// -------- Historial por URL --------
// GET /api/audit/history?url=<url>
export async function getAuditHistory(req, res) {
  try {
    const rawParam = (req.query?.url ?? '').toString().trim();
    if (!rawParam) return res.status(400).json({ error: 'Falta el parámetro url' });

    let decoded = rawParam;
    try { decoded = decodeURIComponent(rawParam); } catch {}

    const stripHash  = (u) => u.split('#')[0];
    const stripQuery = (u) => u.split('?')[0];
    const stripSlash = (u) => (u.endsWith('/') ? u.slice(0, -1) : u);
    const base = stripSlash(stripQuery(stripHash(decoded)));

    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rxBase = new RegExp('^' + esc(base) + '/?$', 'i');

    const filter = { $or: [
      { url: decoded },
      { url: base },
      { url: base + '/' },
      { url: { $regex: rxBase } },
    ]};

    const docs = await Audit.find(filter).sort({ fecha: 1 }).lean();

    const out = (docs || []).map((o) => {
      let perf = (typeof o.performance === 'number' && !Number.isNaN(o.performance)) ? Math.round(o.performance) : null;
      if (perf == null && typeof o.audit?.pagespeed?.performance === 'number') {
        perf = Math.round(o.audit.pagespeed.performance);
      }
      if (perf == null) {
        const score = o.audit?.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score;
        if (typeof score === 'number') perf = Math.round(score * 100);
      }

      const pick = (key) => {
        const v =
          o.metrics?.[key] ??
          o.audit?.pagespeed?.metrics?.[key] ??
          o.audit?.unlighthouse?.metrics?.[key] ??
          o.audit?.pagespeed?.[key] ??
          o.audit?.unlighthouse?.[key] ?? null;
        return (typeof v === 'number' && !Number.isNaN(v)) ? v : null;
      };

      return {
        _id: o._id,
        url: o.url,
        fecha: o.fecha,
        performance: perf,
        metrics: {
          lcp:  pick('lcp'),
          fcp:  pick('fcp'),
          tbt:  pick('tbt'),
          si:   pick('si'),
          ttfb: pick('ttfb'),
        },
        audit:    o.audit,
        email:    o.email,
        strategy: o.strategy,
        type:     o.type,
        tipos:    o.tipos,
      };
    });

    return res.json(out);
  } catch (e) {
    console.error('❌ getAuditHistory error:', e);
    return res.status(200).json([]); // degradar a vacío para no romper el front
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/audit/send-report  → envía histórico por correo (formateado)
// ─────────────────────────────────────────────────────────────
export async function sendReport(req, res) {
  try {
    const { url, email } = req.body || {};
    if (!url || !email) {
      return res.status(400).json({ error: 'Falta parámetro url o email' });
    }

    const docs = await Audit.find({ url }).sort({ fecha: 1 });
    if (!docs.length) {
      return res.status(404).json({ error: 'No hay datos previos para esa URL' });
    }

    // helpers
    const toSec1 = (ms) =>
      (typeof ms === 'number' && !Number.isNaN(ms))
        ? `${(Math.round((ms / 1000) * 10) / 10).toFixed(1)}s`
        : 'N/A';

    const readMs = (doc, key) => {
      const p = doc?.audit?.pagespeed || {};
      const u = doc?.audit?.unlighthouse || {};

      if (doc?.metrics && typeof doc.metrics[key] === 'number') return doc.metrics[key];
      if (p?.metrics && typeof p.metrics[key] === 'number') return p.metrics[key];
      if (u?.metrics && typeof u.metrics[key] === 'number') return u.metrics[key];
      if (typeof p[key] === 'number') return p[key];
      if (typeof u[key] === 'number') return u[key];

      const idMap = {
        fcp: 'first-contentful-paint',
        lcp: 'largest-contentful-paint',
        tbt: 'total-blocking-time',
        si:  'speed-index',
        ttfb: 'server-response-time',
      };
      const lhr = p?.raw?.lighthouseResult;
      const id  = idMap[key];
      const nv  = lhr?.audits?.[id]?.numericValue;
      return (typeof nv === 'number') ? nv : null;
    };

    const readPerf = (doc) => {
      if (typeof doc?.performance === 'number' && !Number.isNaN(doc.performance)) {
        return Math.round(doc.performance);
      }
      const p = doc?.audit?.pagespeed || {};
      if (typeof p.performance === 'number') return Math.round(p.performance);
      const score = p?.raw?.lighthouseResult?.categories?.performance?.score;
      if (typeof score === 'number') return Math.round(score * 100);
      return 'N/A';
    };

    const rowsHtml = docs.map((doc, i) => {
      const fecha = new Date(doc.fecha).toLocaleString();
      const perf  = readPerf(doc);

      const lcp  = toSec1(readMs(doc, 'lcp'));
      const fcp  = toSec1(readMs(doc, 'fcp'));
      const tbt  = toSec1(readMs(doc, 'tbt'));   // también en segundos como en el diagnóstico
      const si   = toSec1(readMs(doc, 'si'));
      const ttfb = toSec1(readMs(doc, 'ttfb'));

      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      return `
        <tr style="background:${bg}">
          <td style="padding:8px;border:1px solid #ddd">${fecha}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${perf}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${lcp}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${fcp}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${tbt}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${si}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${ttfb}</td>
        </tr>`;
    }).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#333">
        <h2 style="text-align:center;color:#2563EB">
          Informe Histórico de <a href="${url}" style="color:#2563EB;text-decoration:underline">${url}</a>
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#2563EB;color:#fff">
              <th style="padding:12px;border:1px solid #ddd">Fecha / Hora</th>
              <th style="padding:12px;border:1px solid #ddd">Perf.</th>
              <th style="padding:12px;border:1px solid #ddd">LCP</th>
              <th style="padding:12px;border:1px solid #ddd">FCP</th>
              <th style="padding:12px;border:1px solid #ddd">TBT</th>
              <th style="padding:12px;border:1px solid #ddd">SI</th>
              <th style="padding:12px;border:1px solid #ddd">TTFB</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <p style="text-align:right;font-size:0.85em;margin-top:24px;color:#666">
          Generado el ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from:    process.env.EMAIL_USER,
      to:      email,
      subject: `Informe Histórico de ${url}`,
      html
    });

    return res.status(200).json({ message: 'Informe enviado correctamente' });
  } catch (err) {
    console.error('❌ Error al enviar el informe:', err);
    return res.status(500).json({ error: 'Error al enviar el informe', detail: err.message });
  }
}

// -------- Enviar diagnóstico individual --------
// POST /api/audit/send-diagnostic
// POST /api/audit/send-diagnostic
// Envía SOLO el PDF adjunto (sin body HTML). Si no llega email por body,
// intenta obtenerlo desde el registro del diagnóstico usando el id.
export async function sendDiagnostic(req, res) {
  try {
    const { url, email, subject, pdf, id } = req.body || {};

    if (!pdf?.base64) {
      return res.status(400).json({ error: 'Falta el PDF (base64)' });
    }

    // Si no llega email en el body, intenta sacarlo del diagnóstico
    let toEmail = (email || '').trim();
    if (!toEmail && id) {
      try {
        const doc = await Audit.findById(id).lean();
        if (doc?.email) toEmail = String(doc.email).trim();
      } catch (_) {}
    }
    if (!toEmail) {
      // Como último recurso, usa el correo de .env para que no falle
      toEmail = process.env.EMAIL_USER;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const filenameSafe = (url || 'sitio')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);

    const filename = pdf.filename || `diagnostico_${filenameSafe}.pdf`;

    await transporter.sendMail({
      from:    process.env.EMAIL_USER,
      to:      toEmail,
      subject: subject || (url ? `Diagnóstico de ${url}` : 'Diagnóstico'),
      text:    'Adjunto el informe en PDF.',           // 👈 SOLO texto plano
      // ❌ sin 'html'
      attachments: [{
        filename,
        content: Buffer.from(pdf.base64, 'base64'),
        contentType: pdf.contentType || 'application/pdf'
      }]
    });

    return res.status(200).json({ message: 'Informe de diagnóstico enviado correctamente' });
  } catch (e) {
    console.error('❌ Error en sendDiagnostic:', e);
    return res.status(500).json({ error: 'Error al enviar el diagnóstico', detail: e.message });
  }
}
