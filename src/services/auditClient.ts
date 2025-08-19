// src/services/auditClient.ts
const API_BASE = "/api";

export type Strategy = "mobile" | "desktop";
export type Category =
  | "performance"
  | "accessibility"
  | "best-practices"
  | "seo"
  | "pwa"
  | (string & {}); // extensible

export type StartAuditRequest = {
  url: string;
  strategy?: Strategy;
  categories?: Category[];
};

export type AuditStatus = "pending" | "done" | "error" | (string & {});
export type GetAuditResponse = {
  status: AuditStatus;
  result?: unknown;
  error?: string;
  [k: string]: unknown;
};

export type StartAuditResponse = {
  jobId?: string;
  [k: string]: unknown;
};

export async function startAudit({
  url,
  strategy = "mobile",
  categories = ["performance"],
}: StartAuditRequest): Promise<StartAuditResponse> {
  const res = await fetch(`${API_BASE}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, strategy, categories }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`startAudit ${res.status}: ${text}`);
  }
  return (await res.json()) as StartAuditResponse;
}

export async function getAudit(jobId: string): Promise<GetAuditResponse> {
  const res = await fetch(`${API_BASE}/audit/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`getAudit ${res.status}: ${text}`);
  }
  return (await res.json()) as GetAuditResponse;
}

/**
 * Polling hasta obtener status === 'done'
 * intervalMs: intervalo entre polls (por defecto 2000ms)
 * timeoutMs: tiempo máximo antes de abortar (por defecto 90s)
 */
export async function waitForAuditResult(
  jobId: string,
  { intervalMs = 2000, timeoutMs = 90_000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<GetAuditResponse> {
  const start = Date.now();
  for (;;) {
    const data = await getAudit(jobId);
    if (data.status === "done" && data.result) return data;

    if (Date.now() - start > timeoutMs) {
      throw new Error("Timeout esperando el resultado del diagnóstico");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// Alias útil para el hook useAudit que importaba `fetchAudit`
export async function fetchAudit(id: string): Promise<GetAuditResponse> {
  return getAudit(id);
}
