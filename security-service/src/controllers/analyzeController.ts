import express from 'express';
import { analyzeSecurity } from '../services/securityAnalyzer.ts';
// Retain type aliases
type Request = express.Request;
type Response = express.Response;

export async function analyzeUrl(req: Request, res: Response) {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL requerida' });
  try {
    const result = await analyzeSecurity(url);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al analizar la URL', details: err?.message || String(err) });
  }
}
