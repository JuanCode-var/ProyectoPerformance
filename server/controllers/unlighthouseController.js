// server/controllers/unlighthouseController.js  (ESM)
import axios from 'axios';

export async function unlighthouseAudit(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta url' });
  try {
    const msUrl = process.env.MS_UNLIGHTHOUSE_URL || 'http://localhost:3002/audit';
    const { data } = await axios.post(msUrl, { url });
    res.json(data);
  } catch (err) {
    console.error('Error en UnlighthouseController:', err.message);
    res.status(500).json({ error: err.message, detail: err.response?.data });
  }
}
