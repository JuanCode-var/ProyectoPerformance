// server/controllers/auditHistory.controller.js  (ESM)
import Audit from '../database/esquemaBD.js';

export async function getAudits(req, res) {
  try {
    const { url, type, from, to, limit = 100, sort = 'desc' } = req.query;

    const q = {};
    if (url)  q.url   = url;
    if (type) q.tipos = type;
    if (from || to) {
      q.fecha = {};
      if (from) q.fecha.$gte = new Date(from);
      if (to)   q.fecha.$lte = new Date(to);
    }

    const docs = await Audit.find(q)
      .sort({ fecha: sort === 'asc' ? 1 : -1 })
      .limit(Number(limit));

    res.json(docs);
  } catch (err) {
    console.error('getAudits error', err);
    res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}




