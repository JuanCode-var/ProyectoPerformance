// src/services/audit.service.ts
export async function fetchAudits({
  url,
  type,
  from,
  to,
  limit = 100,
  sort = 'desc'
}: {
  url?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: string;
}) {
  const params = new URLSearchParams();
  if (url) params.append('url', url);
  if (type) params.append('type', type);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  params.append('limit', String(limit));
  params.append('sort', sort);

  const res = await fetch(`/api/audits?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchAudit(id: string) {
  const res = await fetch(`/api/audit/${id}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${res.status}`);
  }
  return res.json(); // { status: 'pending' | 'done', audit: { pagespeed: { ... } } }
}
