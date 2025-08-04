// server/controllers/unlighthouseController.js
import axios from 'axios';

const UNLIGHTHOUSE_ENDPOINT =
  process.env.MS_UNLIGHTOUSE_URL || 'http://localhost:3002/audit';

export async function unlighthouseAudit(req, res) {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Llamada al microservicio
    const { data } = await axios.post(UNLIGHTHOUSE_ENDPOINT, { url });
    // Devolvemos el JSON tal cual
    return res.json({ type: 'unlighthouse', ...data });
  } catch (err) {
    console.error('❌ unlighthouseAudit error:', err.message);
    return res.status(err.response?.status || 500).json({
      error: err.message,
      detail: err.response?.data,
    });
  }
}
