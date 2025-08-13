import axios from 'axios';
import nodemailer from 'nodemailer';
import Audit from '../database/esquemaBD.js';

// Asegura que el endpoint termine en /audit
function withAudit(base) {
  if (!base) return '/audit';
  const trimmed = String(base).replace(/\/+$/, '');
  return trimmed.endsWith('/audit') ? trimmed : `${trimmed}/audit`;
}

// POST /api/audit
export async function guardarDatos(req, res) {
  try {
    const {
      url,
      type = 'pagespeed',
      strategy = 'mobile',
      name,
      email,
      nocache,
    } = req.body || {};

    if (!url) return res.status(400).json({ error: 'Falta parámetro url' });

    const MS_PAGESPEED_URL     = process.env.MS_PAGESPEED_URL     || 'http://localhost:3001';
    const MS_UNLIGHTHOUSE_URL  = process.env.MS_UNLIGHTHOUSE_URL  || 'http://localhost:3002';

    const MICROSERVICES = {
      pagespeed:    { endpoint: withAudit(MS_PAGESPEED_URL) },
      unlighthouse: { endpoint: withAudit(MS_UNLIGHTHOUSE_URL) },
    };

    const tipos = Array.isArray(type)
      ? type
      : (type === 'all' ? Object.keys(MICROSERVICES) : [type]);

    const invalid = tipos.filter(t => !MICROSERVICES[t]);
    if (invalid.length) {
      return res.status(400).json({ error: `Tipo(s) inválido(s): ${invalid.join(', ')}` });
    }

    // Cache 1h
    const CACHE_TTL = 1000 * 60 * 60;
    const cutoff = new Date(Date.now() - CACHE_TTL);
    const cached = await Audit.findOne({ url, tipos, strategy, fecha: { $gte: cutoff } });
    if (!nocache && cached) {
      const resp = cached.toObject();
      resp.isLocal = resp?.audit?.pagespeed?.meta?.source === 'local';
      return res.json(resp);
    }

    const calls = tipos.map(t => {
      const endpoint = MICROSERVICES[t].endpoint;
      const payload  = (t === 'unlighthouse') ? { url } : { url, strategy };
      return axios
        .post(endpoint, payload, { timeout: 300000 })
        .then(r => ({ [t]: r.data }))
        .catch(err => {
          const msg = err?.response?.data?.detail || err?.response?.data?.error || err.message || 'error';
          const status = err?.response?.status ?? null;
          return { [t]: { error: msg, status } };
        });
    });

    const audit = (await Promise.all(calls))
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});

    const onlyPagespeedOk = (tipos.length === 1) && audit.pagespeed && !audit.pagespeed.error;

    const perfResolved =
      (onlyPagespeedOk && typeof audit.pagespeed?.performance === 'number' && !Number.isNaN(audit.pagespeed.performance))
        ? Math.round(audit.pagespeed.performance)
        : (onlyPagespeedOk && audit.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score != null
            ? Math.round(audit.pagespeed.raw.lighthouseResult.categories.performance.score * 100)
            : undefined);

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

    const out = doc.toObject();
    out.isLocal = out?.audit?.pagespeed?.meta?.source === 'local';
    return res.status(201).json(out);
  } catch (e) {
    console.error('❌ Error en guardarDatos:', e);
    return res.status(500).json({ error: 'Error al procesar la auditoría', detail: e.message });
  }
}

// GET /api/audit/:id
export async function getAuditById(req, res) {
  try {
    const id = req.params?.id;
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

// GET /api/audit/history?url=<url>
export async function getAuditHistory(req, res) {
  try {
    const rawParam = (req.query?.url ?? '').toString().trim();
    if (!rawParam) return res.status(400).json({ error: 'Falta el parámetro url' });

    let decoded = rawParam;
    try { decoded = decodeURIComponent(rawParam); } catch (_) {}

    const stripHash  = (u) => u.split('#')[0];
    const stripQuery = (u) => u.split('?')[0];
    const stripSlash = (u) => (u.endsWith('/') ? u.slice(0, -1) : u);
    const base = stripSlash(stripQuery(stripHash(decoded)));

    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rxBase = new RegExp('^' + esc(base) + '/?$', 'i');

    const filter = {
      $or: [
        { url: decoded },
        { url: base },
        { url: base + '/' },
        { url: { $regex: rxBase } },
      ],
    };

    const docs = await Audit.find(filter).sort({ fecha: 1 }).lean();

    const out = (docs || []).map((d) => {
      const o = d || {};

      let perf = (typeof o.performance === 'number' && !Number.isNaN(o.performance))
        ? Math.round(o.performance)
        : null;

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
          o.audit?.unlighthouse?.[key] ??
          null;
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

// POST /api/audit/send-report (comparativa/histórico)
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

    const rowsHtml = docs.map((doc, i) => {
      const fecha = new Date(doc.fecha).toLocaleString();
      const perf  = doc.performance ?? 'N/A';

      const read = key => {
        let v;
        if (doc.metrics?.[key] != null) v = doc.metrics[key];
        else if (doc.audit.pagespeed?.metrics?.[key] != null)
          v = doc.audit.pagespeed.metrics[key];
        else if (doc.audit.unlighthouse?.metrics?.[key] != null)
          v = doc.audit.unlighthouse.metrics[key];
        else if (doc.audit.pagespeed?.[key] != null)
          v = doc.audit.pagespeed[key];
        else if (doc.audit.unlighthouse?.[key] != null)
          v = doc.audit.unlighthouse[key];
        else
          return 'N/A';
        if (key === 'tbt' && v === 0) return 'N/A';
        return typeof v === 'number' ? Math.round(v) : v;
      };

      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      return `
        <tr style="background:${bg}">
          <td style="padding:8px;border:1px solid #ddd">${fecha}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${perf}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${read('lcp')}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${read('fcp')}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${read('tbt')}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${read('si')}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${read('ttfb')}</td>
        </tr>`;
    }).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#333">
        <h2 style="text-align:center;color:#2563EB">Informe Histórico de ${url}</h2>
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