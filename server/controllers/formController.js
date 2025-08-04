// server/controllers/formController.js
import axios from 'axios';
import Audit from '../database/esquemaBD.js';

/* ───────────── ENDPOINTS ───────────── */
function withAudit(path) {
  return path.endsWith('/audit')
    ? path
    : `${path.replace(/\/$/, '')}/audit`;
}

const MICROSERVICES = {
  pagespeed:    { endpoint: withAudit(process.env.MS_PAGESPEED_URL     || 'http://localhost:3001') },
  unlighthouse: { endpoint: withAudit(process.env.MS_UNLIGHTHOUSE_URL || 'http://localhost:3002') },
};

/* ───────────── CACHE ───────────── */
const CACHE_TTL = 1000 * 60 * 60; // 1 h

/* ───────────── POST /api/audit ───────────── */
export async function guardarDatos(req, res) {
  try {
    // ← Aquí incluimos name y email
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

    /* llamadas paralelas */
    const peticiones = tipos.map(t => {
      const payload = t === 'unlighthouse'
        ? { url }
        : { url, strategy };

      return axios
        .post(MICROSERVICES[t].endpoint, payload)
        .then(r => ({ [t]: r.data }))
        .catch(err => ({
          [t]: {
            error:  err.message,
            detail: err.response?.data
          }
        }));
    });

    const audit = (await Promise.all(peticiones))
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});

    const onlyPagespeed = tipos.length === 1 && !audit.pagespeed?.error;

    const doc = await Audit.create({
      url,
      type:        tipos[0],                  // required por tu schema
      tipos,
      name,                                    // ← ahora existe
      email,                                   // ← ahora existe
      strategy,
      audit,
      performance: onlyPagespeed
        ? audit.pagespeed.performance
        : undefined,
      metrics:     onlyPagespeed
        ? audit.pagespeed.metrics
        : undefined,
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
    res.json(doc);
  } catch (e) {
    console.error('getAuditById error', e);
    res.status(500).json({ error: 'Error interno' });
  }
}

