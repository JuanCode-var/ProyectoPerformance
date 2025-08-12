// src/services/auditClient.js
const API_BASE = '/api';

export async function startAudit({ url, strategy = 'mobile', categories = ['performance'] }) {
  const res = await fetch(`${API_BASE}/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, strategy, categories })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`startAudit ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getAudit(jobId) {
  const res = await fetch(`${API_BASE}/audit/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`getAudit ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Polling hasta obtener status === 'done'
 * intervalMs: intervalo entre polls (por defecto 2000ms)
 * timeoutMs: tiempo máximo antes de abortar (por defecto 90s)
 */
export async function waitForAuditResult(jobId, { intervalMs = 2000, timeoutMs = 90000 } = {}) {
  const start = Date.now();
  while (true) {
    const data = await getAudit(jobId);
    if (data.status === 'done' && data.result) return data;

    if (Date.now() - start > timeoutMs) {
      throw new Error('Timeout esperando el resultado del diagnóstico');
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}
