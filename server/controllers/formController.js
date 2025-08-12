// server/controllers/formController.js
import axios from 'axios';
import Audit from '../database/esquemaBD.js';
import nodemailer from 'nodemailer';

// TTL de caché (1 hora)
const CACHE_TTL = 1000 * 60 * 60;

/* ───────────── POST /api/audit ───────────── */
export async function guardarDatos(req, res) {
  try {
    const {
      url,
      type     = 'pagespeed',
      strategy = 'mobile',
      name,
      email,
      nocache
    } = req.body || {};

    if (!url || !type) {
      return res.status(400).json({ error: 'Faltan parámetros url o type' });
    }

    // Endpoints de microservicios, asegurando que terminen en /audit sin duplicar
    const MICROSERVICES = {
      pagespeed:    { endpoint: withAudit(process.env.MS_PAGESPEED_URL     || 'http://localhost:3001') },
      unlighthouse: { endpoint: withAudit(process.env.MS_UNLIGHTHOUSE_URL || 'http://localhost:3002') },
    };

    // tipos a ejecutar
    const tipos = Array.isArray(type)
      ? type
      : (type === 'all' ? Object.keys(MICROSERVICES) : [type]);

    // valida tipos
    const invalidos = tipos.filter(t => !MICROSERVICES[t]);
    if (invalidos.length) {
      return res.status(400).json({ error: `Tipo(s) inválido(s): ${invalidos.join(', ')}` });
    }

    // Cache 1h por URL+estrategia+tipos (permitimos forzar no usar cache con nocache=true)
    const cutoff = new Date(Date.now() - CACHE_TTL);
    const cached = await Audit.findOne({
      url,
      tipos,
      strategy,
      fecha: { $gte: cutoff }
    });
    if (!nocache && cached) {
      const respCached = cached.toObject();
      respCached.isLocal = respCached?.audit?.pagespeed?.meta?.source === 'local';
      return res.json(respCached);
    }

    // Ejecuta microservicios (payload definido dentro del map)
    const peticiones = tipos.map(t => {
      const payload = t === 'unlighthouse' ? { url } : { url, strategy };

      return axios
        .post(MICROSERVICES[t].endpoint, payload, { timeout: 300000 })
        .then(r => ({ [t]: r.data })) // NO r.data.data
        .catch(err => {
          const status = err?.response?.status ?? null;
          const detail =
            err?.response?.data?.detail ||
            err?.response?.data?.error ||
            err?.message ||
            'Error llamando al micro';
          return { [t]: { error: detail, status } };
        });
    });

    const audit = (await Promise.all(peticiones))
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});

    // Resolver performance para guardarlo en plano si es solo pagespeed
    const perfResolved =
      (typeof audit.pagespeed?.performance === 'number' && !Number.isNaN(audit.pagespeed.performance))
        ? Math.round(audit.pagespeed.performance)
        : (audit.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score != null
            ? Math.round(audit.pagespeed.raw.lighthouseResult.categories.performance.score * 100)
            : undefined);

    const onlyPagespeed = tipos.length === 1 && !audit.pagespeed?.error;

    const doc = await Audit.create({
      url,
      type:        tipos[0],
      tipos,
      name,
      email,
      strategy,
      audit,
      performance: onlyPagespeed ? perfResolved : undefined,
      metrics:     onlyPagespeed ? audit.pagespeed?.metrics : undefined,
      fecha:       new Date(),
    });

    // 👉 Añadimos flag solo para la respuesta (no se persiste)
    const resp = doc.toObject();
    resp.isLocal = resp?.audit?.pagespeed?.meta?.source === 'local';

    return res.status(201).json(resp);
  } catch (e) {
    console.error('❌ Error en guardarDatos:', e);
    return res.status(500).json({ error: 'Error al procesar la auditoría', detail: e.message });
  }
}

/* ───────────── GET /api/audit/:id ───────────── */
export async function getAuditById(req, res) {
  try {
    const doc = await Audit.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });

    const out = doc.toObject();
    out.isLocal = out?.audit?.pagespeed?.meta?.source === 'local'; // 👉 flag para el front
    return res.json(out);
  } catch (e) {
    console.error('❌ Error en getAuditById:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
}

/* ───────────── GET /api/audit/history?url=<url> ───────────── */
export async function getAuditHistory(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Falta el parámetro url' });
    }
    const docs = await Audit.find({ url }).sort({ fecha: 1 });

    // Recalcular performance en la respuesta si faltara (para que el histórico no muestre 0)
    const out = docs.map(d => {
      const o = d.toObject();

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

      if (perf != null) o.performance = perf;
      return o;
    });

    return res.json(out);
  } catch (e) {
    console.error('❌ Error en getAuditHistory:', e);
    return res.status(500).json({ error: 'Error interno al obtener histórico' });
  }
}

// Utilitarios
function withAudit(path) {
  return path.endsWith('/audit')
    ? path
    : `${path.replace(/\/$/, '')}/audit`;
}

/* ───────────── POST /api/audit/send-report ───────────── */
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
