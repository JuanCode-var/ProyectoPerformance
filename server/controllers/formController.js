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

    // 1) Recupera todas las auditorías para esa URL
    const docs = await Audit.find({ url }).sort({ fecha: 1 });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'No hay datos previos para esa URL' });
    }

    // 2) Construye filas de la tabla con zebra stripe
    const rowsHtml = docs.map((doc, i) => {
      const fecha = new Date(doc.fecha).toLocaleString();
      const perf  = doc.performance ?? 'N/A';
      const m      = doc.audit.pagespeed?.metrics || doc.audit.unlighthouse?.metrics || {};
      const bg    = i % 2 === 0 ? '#f9fafb' : '#ffffff';

      return `
        <tr style="background: ${bg};">
          <td style="padding: 8px; border: 1px solid #ddd;">${fecha}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${perf}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.lcp  ?? 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.fcp  ?? 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.cls  ?? 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.tbt  ?? 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.si   ?? 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.ttfb ?? 'N/A'}</td>
        </tr>`;
    }).join('');

    // 3) Monta el HTML completo
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
        <h2 style="text-align: center; color: #2563EB;">Informe Histórico de ${url}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background: #2563EB; color: #fff;">
              <th style="padding: 12px; border: 1px solid #ddd;">Fecha / Hora</th>
              <th style="padding: 12px; border: 1px solid #ddd;">Performance</th>
              <th style="padding: 12px; border: 1px solid #ddd;">LCP</th>
              <th style="padding: 12px; border: 1px solid #ddd;">FCP</th>
              <th style="padding: 12px; border: 1px solid #ddd;">CLS</th>
              <th style="padding: 12px; border: 1px solid #ddd;">TBT</th>
              <th style="padding: 12px; border: 1px solid #ddd;">SI</th>
              <th style="padding: 12px; border: 1px solid #ddd;">TTFB</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <p style="text-align: right; margin-top: 24px; font-size: 0.85em; color: #666;">
          Generado el ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    // 4) Crea el transporter usando Gmail (app password)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // 5) Envía el correo con HTML enriquecido
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to:   email,
      subject: `Informe Histórico de ${url}`,
      html
    });

    return res.json({ message: 'Informe enviado correctamente' });
  } catch (err) {
    console.error('❌ Error al enviar el informe:', err);
    return res.status(500).json({ error: 'Error al enviar el informe' });
  }
}