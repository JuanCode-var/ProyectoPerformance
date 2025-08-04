// server/controllers/formController.js
import axios from 'axios';
import Audit from '../database/esquemaBD.js';
import nodemailer from 'nodemailer';

/* ───────────── POST /api/audit ───────────── */
export async function guardarDatos(req, res) {
  try {
    const {
      url,
      type     = 'pagespeed',
      strategy = 'mobile',
      name,
      email
    } = req.body;

    if (!url || !type) {
      return res.status(400).json({ error: 'Faltan parámetros url o type' });
    }

    const MICROSERVICES = {
      pagespeed:    { endpoint: withAudit(process.env.MS_PAGESPEED_URL     || 'http://localhost:3001') },
      unlighthouse: { endpoint: withAudit(process.env.MS_UNLIGHTHOUSE_URL || 'http://localhost:3002') },
    };

    const tipos = Array.isArray(type)
      ? type
      : type === 'all'
        ? Object.keys(MICROSERVICES)
        : [type];

    const invalidos = tipos.filter(t => !MICROSERVICES[t]);
    if (invalidos.length) {
      return res
        .status(400)
        .json({ error: `Tipo(s) inválido(s): ${invalidos.join(', ')}` });
    }

    const cutoff = new Date(Date.now() - CACHE_TTL);
    const cached = await Audit.findOne({
      url,
      tipos,
      strategy,
      fecha: { $gte: cutoff }
    });
    if (cached) return res.json(cached);

    const peticiones = tipos.map(t => {
      const payload = t === 'unlighthouse'
        ? { url }
        : { url, strategy };

      return axios
        .post(MICROSERVICES[t].endpoint, payload)
        .then(r => ({ [t]: r.data }))
        .catch(err => ({
          [t]: { error: err.message, detail: err.response?.data }
        }));
    });

    const audit = (await Promise.all(peticiones))
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});

    const onlyPagespeed = tipos.length === 1 && !audit.pagespeed?.error;

    const doc = await Audit.create({
      url,
      type:        tipos[0],
      tipos,
      name,
      email,
      strategy,
      audit,
      performance: onlyPagespeed ? audit.pagespeed.performance : undefined,
      metrics:     onlyPagespeed ? audit.pagespeed.metrics     : undefined,
      fecha:       new Date(),
    });

    return res.status(201).json(doc);
  } catch (e) {
    console.error('❌ Error en guardarDatos:', e);
    return res.status(500).json({ error: 'Error al procesar la auditoría' });
  }
}

/* ───────────── GET /api/audit/:id ───────────── */
export async function getAuditById(req, res) {
  try {
    const doc = await Audit.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    return res.json(doc);
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
    return res.json(docs);
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

const CACHE_TTL = 1000 * 60 * 60; // 1h

// … aquí van tus otras funciones: guardarDatos, getAuditById, getAuditHistory, etc …

/* ───────────── POST /api/audit/send-report ───────────── */
export async function sendReport(req, res) {
  try {
    const { url, email } = req.body;
    if (!url || !email) {
      return res.status(400).json({ error: 'Falta parámetro url o email' });
    }

    // Recupera todo el historial de esa URL
    const docs = await Audit.find({ url }).sort({ fecha: 1 });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'No hay datos previos para esa URL' });
    }

    // Monta una tabla HTML con tus métricas más relevantes
    let rows = docs.map(doc => {
      const d = new Date(doc.fecha).toLocaleString();
      const p = doc.performance ?? '-';
      const m = doc.metrics || {};
      return `
        <tr>
          <td style="padding:4px;border:1px solid #ccc">${d}</td>
          <td style="padding:4px;border:1px solid #ccc">${p}</td>
          <td style="padding:4px;border:1px solid #ccc">${m.lcp  ?? '-'}</td>
          <td style="padding:4px;border:1px solid #ccc">${m.fcp  ?? '-'}</td>
          <td style="padding:4px;border:1px solid #ccc">${m.cls  ?? '-'}</td>
          <td style="padding:4px;border:1px solid #ccc">${m.tbt  ?? '-'}</td>
          <td style="padding:4px;border:1px solid #ccc">${m.si   ?? '-'}</td>
          <td style="padding:4px;border:1px solid #ccc">${m.ttfb ?? '-'}</td>
        </tr>`;
    }).join('');

    const html = `
      <h1>Informe Histórico de ${url}</h1>
      <table style="border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:4px;border:1px solid #ccc">Fecha hora</th>
            <th style="padding:4px;border:1px solid #ccc">Perf.</th>
            <th style="padding:4px;border:1px solid #ccc">LCP</th>
            <th style="padding:4px;border:1px solid #ccc">FCP</th>
            <th style="padding:4px;border:1px solid #ccc">CLS</th>
            <th style="padding:4px;border:1px solid #ccc">TBT</th>
            <th style="padding:4px;border:1px solid #ccc">SI</th>
            <th style="padding:4px;border:1px solid #ccc">TTFB</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    // Configura tu transporte SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `Informe histórico de ${url}`,
      html,
    });

    return res.json({ message: 'Informe enviado correctamente' });
  } catch (e) {
    console.error('❌ Error en sendReport:', e);
    return res.status(500).json({ error: 'Error al enviar el informe' });
  }
}


