import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Button } from "../shared/ui/button";
import SecurityScoreWidget from "./SecurityScoreWidget";

// Pequeño separador visual reutilizable (igual que en DiagnosticoView)
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="w-full my-6" role="separator" aria-label={label}>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <div className="text-[11px] sm:text-xs uppercase tracking-wider text-slate-500 select-none px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
          {label}
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
      </div>
    </div>
  );
}

// Small inline icons
const Caret = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
    aria-hidden
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const CopyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <rect
      x="9"
      y="9"
      width="10"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="5"
      y="5"
      width="10"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

// Helper local
async function safeParseJSON(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { _raw: text };
  }
}

type HeaderMeta = {
  title?: string;
  description?: string;
  recommendation?: string;
  learnMore?: string;
  why?: string;
  scoreImpact?: number;
  nginx?: string;
  apache?: string;
  express?: string;
  expected?: string;
};

const HEADER_INFO: Record<string, HeaderMeta> = {
  "content-security-policy": {
    title: "Content-Security-Policy (CSP)",
    description: "Controla qué recursos puede cargar la página para mitigar XSS.",
    recommendation: "Defina una política CSP restrictiva (evite 'unsafe-inline').",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    why: "Sin CSP, aplicaciones son más vulnerables a inyección de scripts.",
    expected: "Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'",
    nginx: "add_header Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'none'\" always;",
    apache: "Header set Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'none'\"",
    express: "res.set('Content-Security-Policy', \"default-src 'self'; object-src 'none'; frame-ancestors 'none'\");",
  },
  "strict-transport-security": {
    title: "Strict-Transport-Security (HSTS)",
    description: "Forza el uso de HTTPS para evitar ataques de downgrade.",
    recommendation: "Habilite HSTS con un max-age elevado e includeSubDomains si aplica.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    why: "Sin HSTS, usuarios pueden ser forzados a usar HTTP en ciertos ataques.",
    expected: "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    nginx: "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
    apache: "Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\"",
    express: "res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');",
  },
  "x-frame-options": {
    title: "X-Frame-Options",
    description: "Evita que la página sea embebida en iframes (clickjacking).",
    recommendation: "Use DENY o SAMEORIGIN según el caso.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    why: "Protege contra ataques de clickjacking.",
    expected: "X-Frame-Options: DENY",
  },
  "x-content-type-options": {
    title: "X-Content-Type-Options",
    description: "Evita que el navegador haga MIME sniffing.",
    recommendation: "Use X-Content-Type-Options: nosniff.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
    expected: "X-Content-Type-Options: nosniff",
  },
  "referrer-policy": {
    title: "Referrer-Policy",
    description: "Controla cuánta información de referencia se envía.",
    recommendation: "Use 'strict-origin-when-cross-origin' o más restrictivo.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
    expected: "Referrer-Policy: strict-origin-when-cross-origin",
  },
  "permissions-policy": {
    title: "Permissions-Policy",
    description: "Restringe APIs del navegador (geolocación, cámara, etc.).",
    recommendation: "Defina políticas por defecto lo más restrictivas posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy",
    expected: "Permissions-Policy: geolocation=(), camera=(), microphone=()",
  },
  "cross-origin-opener-policy": {
    title: "Cross-Origin-Opener-Policy",
    description: "Aísla el contexto del documento para mayor seguridad.",
    recommendation: "Use same-origin si es posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
    expected: "Cross-Origin-Opener-Policy: same-origin",
  },
  "cross-origin-embedder-policy": {
    title: "Cross-Origin-Embedder-Policy",
    description: "Requerido para aislar recursos y habilitar ciertas APIs.",
    recommendation: "Use require-corp si es posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy",
    expected: "Cross-Origin-Embedder-Policy: require-corp",
  },
  "cache-control": {
    title: "Cache-Control",
    description: "Controla el cacheo del contenido (útil para información sensible).",
    recommendation: "Para contenido sensible: no-store, no-cache, must-revalidate.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control",
    expected: "Cache-Control: no-store, no-cache, must-revalidate",
  },
  server: {
    title: "Server",
    description: "Exponer la tecnología del servidor puede ayudar a fingerprinting.",
    recommendation: "Oculte o generalice el valor del header Server.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server",
  },
  "x-powered-by": {
    title: "X-Powered-By",
    description: "Divulga la tecnología usada (Express, PHP, etc.).",
    recommendation: "Elimínelo para evitar fuga de información.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Powered-By",
  },
};

const CRITICAL_HEADERS: string[] = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

type PlanItem = { id: string; title: string; recommendation: string; severity?: string };

function deriveSecurityPlan(sr: any): { errors: PlanItem[]; improvements: PlanItem[]; plan: PlanItem[] } {
  const out = { errors: [] as PlanItem[], improvements: [] as PlanItem[], plan: [] as PlanItem[] };

  if (Array.isArray(sr?.findings) && sr.findings.length) {
    const errors = sr.findings.filter((f: any) => f?.passed === false || String(f?.severity || '').toLowerCase().includes('high'));
    const improvements = sr.findings.filter((f: any) => f?.passed !== false && !String(f?.severity || '').toLowerCase().includes('high'));
    out.errors = errors.map((f: any, i: number) => ({
      id: f.id || f.rule || `error-${i}`,
      title: f.title || f.id || f.rule || 'Fallo',
      recommendation: f.recommendation || f.message || f.description || '',
      severity: f.severity || 'high',
    }));
    out.improvements = improvements.map((f: any, i: number) => ({
      id: f.id || f.rule || `imp-${i}`,
      title: f.title || f.id || f.rule || 'Mejora',
      recommendation: f.recommendation || f.message || f.description || '',
      severity: f.severity || 'info',
    }));
  } else if (sr?.headers && typeof sr.headers === 'object') {
    const getPresent = (k: string) => {
      const info = (sr.headers as any)[k];
      return info?.present ?? info?.ok ?? info?.passed ?? (info?.value != null);
    };

    for (const h of CRITICAL_HEADERS) {
      if (!getPresent(h)) {
        const meta = HEADER_INFO[h] || ({} as any);
        out.errors.push({
          id: `missing-${h}`,
          title: `${meta.title || h} ausente`,
          recommendation: meta.recommendation || "Agregar y configurar este encabezado siguiendo buenas prácticas.",
          severity: "high",
        });
      }
    }

    const recommended = [
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "cache-control",
      "server",
      "x-powered-by",
    ];

    for (const h of recommended) {
      if (!getPresent(h)) {
        const meta = HEADER_INFO[h] || ({} as any);
        out.improvements.push({
          id: `missing-${h}`,
          title: `${meta.title || h} no configurado`,
          recommendation: meta.recommendation || 'Valorar su implementación para endurecer seguridad.',
          severity: 'info',
        });
      }
    }
  }

  out.plan = [...out.errors, ...out.improvements];
  return out;
}

const SeverityChart = ({ findings }: { findings: any[] }) => {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings || []) {
    const s = String(f?.severity || '').toLowerCase();
    if (s.includes('high') || s.includes('critical')) counts.high += 1;
    else if (s.includes('medium')) counts.medium += 1;
    else counts.low += 1;
  }
  const total = counts.high + counts.medium + counts.low || 1;
  const items = [
    { label: 'Alta', value: Math.round((counts.high / total) * 100), color: '#ef4444' },
    { label: 'Media', value: Math.round((counts.medium / total) * 100), color: '#f59e0b' },
    { label: 'Baja', value: Math.round((counts.low / total) * 100), color: '#10b981' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color }} />
            <span style={{ fontSize: 12, color: '#334155' }}>{it.label} {`(${it.value}%)`}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {items.map((it) => (
          <div key={it.label} style={{ flex: it.value, height: 12, background: it.color, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
};

const HeaderStatusBars = ({ headers }: { headers?: Record<string, any> }) => {
  const total = Object.keys(headers || {}).length;
  const present = Object.values(headers || {}).filter((h: any) => h && (h.present || h.ok || h.passed || h.value != null)).length;
  const pct = total === 0 ? 0 : Math.round((present / total) * 100);
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Encabezados analizados</h4>
      <div className="mb-2 text-xs text-slate-600">Presentes: {present}/{total}</div>
      <div style={{ background: '#eef2ff', height: 12, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: '#3b82f6', height: '100%' }} />
      </div>
    </div>
  );
};

function getHeaderPresence(info: any) {
  return Boolean(info?.present || info?.ok || info?.passed || info?.value != null);
}

export default function SecurityDiagnosticoPanel({
  url,
  autoRunOnMount = true,
  initialResult,
}: {
  url: string;
  autoRunOnMount?: boolean;
  initialResult?: any;
}) {
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securityResult, setSecurityResult] = useState<any>(null);
  // NEW: history for sparkline in widget inside this panel
  const [securityHistory, setSecurityHistory] = useState<Array<{ fecha: string | number | Date; score: number | null }>>([]);

  const [showSecurityAbout, setShowSecurityAbout] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState<Record<string, boolean>>({});
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const hasRunRef = useRef(false);

  const fetchHistory = async (theUrl: string) => {
    try {
      const ts = Date.now();
      const r = await fetch(`/api/security/history?url=${encodeURIComponent(theUrl)}&_=${ts}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!r.ok) return;
      const data = await safeParseJSON(r);
      if (Array.isArray(data)) {
        setSecurityHistory(
          data.map((d: any) => ({
            fecha: d.fecha,
            score: typeof d.score === "number" ? d.score : null,
          }))
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (url) void fetchHistory(url);
  }, [url]);

  // Si recibimos un resultado inicial (persistido), mostrarlo y evitar auto-run
  useEffect(() => {
    if (initialResult) {
      setSecurityResult(initialResult);
      setSecurityError("");
      setSecurityLoading(false);
      hasRunRef.current = true;
    }
  }, [initialResult]);

  const toggleHeaderDetail = (key: string) =>
    setExpandedHeaders((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyText = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText?.(text);
    } catch {
      // ignore
    }
  };

  const handleSecurityDiagnostics = async () => {
    if (!url) return;
    setSecurityLoading(true);
    setSecurityError("");
    setSecurityResult(null);
    try {
      // 1) Intento directo al proxy
      const res = await fetch("/api/security-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await safeParseJSON(res);
      if (res.ok && !data?.error) {
        setSecurityResult(data);
        // refrescar historial para sparkline
        void fetchHistory(url);
        return;
      }

      // 2) Fallback: usar pipeline del backend que ya implementa reintentos/timeout y persiste
      const res2 = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: "security", nocache: true }),
      });
      const data2 = await safeParseJSON(res2);
      if (!res2.ok || data2?.error) throw new Error(data2?.error || "Error en el análisis de seguridad");

      const sec = (data2?.audit?.security ?? null) || data2?.security || null;
      if (sec) {
        setSecurityResult(sec);
        void fetchHistory(url);
        return;
      }
      throw new Error("Sin datos de seguridad en la respuesta");
    } catch (e: any) {
      setSecurityError(e?.message || "Error desconocido");
    } finally {
      setSecurityLoading(false);
    }
  };

  useEffect(() => {
    if (autoRunOnMount && !hasRunRef.current) {
      hasRunRef.current = true;
      handleSecurityDiagnostics();
    }
  }, [autoRunOnMount, url]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Diagnóstico de Seguridad</CardTitle>
      </CardHeader>
      <CardContent>
        {securityLoading && (
          <div className="space-y-4">
            <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-28 rounded-lg bg-slate-100" />
              <div className="h-28 rounded-lg bg-slate-100" />
              <div className="h-28 rounded-lg bg-slate-100" />
            </div>
            <div className="animate-pulse h-40 rounded-lg bg-slate-100" />
          </div>
        )}
        {securityError && (
          <div className="flex items-center gap-2">
            <p className="error">{securityError}</p>
            <Button variant="outline" onClick={handleSecurityDiagnostics}>Reintentar</Button>
          </div>
        )}
        {!securityLoading && !securityError && !securityResult && (
          <div className="flex flex-col items-center gap-3">
            <p>Haz clic en "Analizar ahora" para revisar los encabezados de seguridad de esta URL.</p>
            <Button variant="outline" onClick={handleSecurityDiagnostics}>Analizar ahora</Button>
          </div>
        )}
        {securityResult && (
          <div className="flex flex-col gap-6">
            {/* Acerca del análisis */}
            <div className="rounded-lg border p-4 bg-slate-50">
              <button
                className="text-sm font-medium text-slate-700 cursor-pointer select-none inline-flex items-center gap-2 hover:text-slate-900"
                onClick={() => setShowSecurityAbout((v) => !v)}
                aria-expanded={showSecurityAbout}
                aria-controls="about-panel"
              >
                <Caret open={showSecurityAbout} />
                Acerca del análisis
              </button>
              <div
                id="about-panel"
                className={`text-sm text-slate-600 mt-2 transition-all ${showSecurityAbout ? "opacity-100" : "opacity-0 hidden"}`}
              >
                El análisis revisa encabezados HTTP, cookies y hallazgos derivados. Proporciona
                recomendaciones y un puntaje orientativo para ayudar a priorizar correcciones.
              </div>
            </div>

            <SectionDivider label="Resumen" />
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border p-4">
                <SecurityScoreWidget
                  score={securityResult?.score ?? securityResult?.securityScore ?? null}
                  grade={securityResult?.grade}
                  history={securityHistory}
                  topFindings={Array.isArray(securityResult?.findings)
                    ? securityResult.findings
                        .filter((f: any) => f?.severity === 'critical' || f?.severity === 'warning')
                        .slice(0, 3)
                    : []}
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">
                      {securityResult?.summary?.passed ??
                        securityResult?.passCount ??
                        (Array.isArray(securityResult?.findings)
                          ? securityResult.findings.filter((f: any) => f?.passed).length
                          : '-')}
                    </span>
                    <span className="ml-2 text-slate-600">OK</span>
                  </div>
                  <div>
                    <span className="font-medium text-amber-600">
                      {securityResult?.summary?.warnings ?? securityResult?.warningCount ?? '-'}
                    </span>
                    <span className="ml-2 text-slate-600">Avisos</span>
                  </div>
                  <div>
                    <span className="font-medium text-red-600">
                      {securityResult?.summary?.failed ??
                        securityResult?.failCount ??
                        (Array.isArray(securityResult?.findings)
                          ? securityResult.findings.filter((f: any) => !f?.passed).length
                          : '-')}
                    </span>
                    <span className="ml-2 text-slate-600">Fallos</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <HeaderStatusBars headers={securityResult?.headers} />
                <div className="mt-3">
                  <SeverityChart findings={securityResult?.findings ?? []} />
                </div>
              </div>
            </div>

            {/* Encabezados */}
            {securityResult?.headers && typeof securityResult.headers === 'object' && (
              <>
                <SectionDivider label="Encabezados" />
                {(() => {
                  const entries = Object.entries(securityResult.headers as Record<string, any>);
                  const sorted = entries.sort(([aKey, aInfo]: any, [bKey, bInfo]: any) => {
                    const aPres = getHeaderPresence(aInfo);
                    const bPres = getHeaderPresence(bInfo);
                    const aCrit = CRITICAL_HEADERS.includes(String(aKey).toLowerCase());
                    const bCrit = CRITICAL_HEADERS.includes(String(bKey).toLowerCase());
                    if (aPres !== bPres) return aPres ? 1 : -1; // faltantes primero
                    if (aCrit !== bCrit) return aCrit ? -1 : 1; // críticos antes
                    return String(aKey).localeCompare(String(bKey));
                  });
                  const filtered = showOnlyMissing
                    ? sorted.filter(([k, info]) => !getHeaderPresence(info))
                    : sorted;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filtered.map(([key, info]) => {
                        const normKey = String(key).toLowerCase();
                        const present = getHeaderPresence(info);
                        const statusColor = present ? '#16a34a' : '#ef4444';
                        const statusText = present ? 'Presente' : 'Falta';
                        const value: string | undefined = (info as any)?.value ?? (info as any)?.expected ?? undefined;
                        const detail = (info as any)?.message || (info as any)?.note || (info as any)?.expected || '';
                        const meta = (HEADER_INFO as any)[normKey] as any;
                        const isExpanded = !!expandedHeaders[normKey];

                        return (
                          <div key={normKey} className="rounded-lg border p-3 transition-colors hover:bg-slate-50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-medium break-words">
                                {meta?.title || normKey}
                                <div className="text-xs text-slate-500">{normKey}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {CRITICAL_HEADERS.includes(normKey) && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700">Crítico</span>
                                )}
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: present ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)', color: statusColor }}
                                  title={present ? 'El encabezado está presente' : 'El encabezado falta'}
                                >
                                  {statusText}
                                </span>
                                <button
                                  className="text-xs text-slate-600 underline cursor-pointer hover:text-slate-900"
                                  onClick={() => toggleHeaderDetail(normKey)}
                                  aria-expanded={isExpanded}
                                >
                                  Detalles
                                </button>
                              </div>
                            </div>

                            {value ? (
                              <div className="mt-2 flex items-center gap-2">
                                <code className="text-xs bg-slate-100 px-2 py-1 rounded whitespace-pre-wrap break-all">
                                  {value}
                                </code>
                                <button
                                  className="p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                                  onClick={() => copyText(String(value))}
                                  title="Copiar valor"
                                  aria-label="Copiar valor"
                                >
                                  <CopyIcon />
                                </button>
                              </div>
                            ) : null}

                            {detail ? (
                              <div className="text-xs text-slate-600 mt-1 break-words">{detail}</div>
                            ) : null}

                            <div className={`mt-2 text-xs bg-slate-50 border rounded p-2 transition-all ${isExpanded ? "opacity-100" : "opacity-0 hidden"}`}>
                              <div><strong>¿Por qué importa?</strong> {meta?.why ?? meta?.description ?? '—'}</div>
                              <div className="mt-1"><strong>Recomendación:</strong> {meta?.recommendation ?? meta?.suggestion ?? '—'}</div>
                              {meta?.expected && (
                                <div className="mt-1">
                                  <strong>Valor recomendado:</strong>
                                  <div>
                                    <code className="text-[11px] bg-white border rounded px-2 py-1 inline-block mt-1">{meta.expected}</code>
                                  </div>
                                </div>
                              )}
                              {meta?.learnMore && (
                                <div className="mt-1">
                                  <a href={meta.learnMore} target="_blank" rel="noreferrer" className="text-blue-600 underline" title="Abrir documentación">Más info</a>
                                </div>
                              )}
                              {meta?.nginx && (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium">nginx</div>
                                  <pre className="text-xs bg-black text-white p-2 rounded mt-1 overflow-auto">{meta.nginx}</pre>
                                </div>
                              )}
                              {meta?.apache && (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium">Apache</div>
                                  <pre className="text-xs bg-black text-white p-2 rounded mt-1 overflow-auto">{meta.apache}</pre>
                                </div>
                              )}
                              {meta?.express && (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium">Node / Express</div>
                                  <pre className="text-xs bg-black text-white p-2 rounded mt-1 overflow-auto">{meta.express}</pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Cookies */}
            {securityResult?.cookies && (
              <>
                <SectionDivider label="Cookies" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Cookies</h3>
                  {Array.isArray(securityResult.cookies) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {securityResult.cookies.map((ck: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between">
                            <div className="font-medium break-words">{ck?.name || '(sin nombre)'}</div>
                            <div className="flex items-center gap-1 text-[10px]">
                              {ck?.secure && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Secure</span>}
                              {ck?.httpOnly && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">HttpOnly</span>}
                              {ck?.sameSite && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">SameSite:{ck.sameSite}</span>}
                            </div>
                          </div>
                          {ck?.value && (
                            <div className="mt-2">
                              <div className="text-[11px] text-slate-500">Valor</div>
                              <code className="text-xs bg-slate-100 px-2 py-1 rounded whitespace-pre-wrap break-all">{ck.value}</code>
                            </div>
                          )}
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            {ck?.domain && <div><span className="font-medium">Dominio:</span> {ck.domain}</div>}
                            {ck?.path && <div><span className="font-medium">Path:</span> {ck.path}</div>}
                            {ck?.expires && <div><span className="font-medium">Expira:</span> {ck.expires}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-xs bg-slate-50 border rounded p-3">
                      {JSON.stringify(securityResult.cookies, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}

            {/* Hallazgos */}
            {Array.isArray(securityResult?.findings) && securityResult.findings.length > 0 && (
              <>
                <SectionDivider label="Hallazgos" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Hallazgos</h3>
                  <div className="flex flex-col gap-2">
                    {securityResult.findings.map((f: any, idx: number) => {
                      const sev = (f?.severity || '').toString().toLowerCase();
                      const color = sev.includes('high') ? '#ef4444' : sev.includes('medium') ? '#f59e0b' : '#2563eb';
                      const passed = f?.passed === true;
                      return (
                        <div key={idx} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-medium break-words">{f?.title || f?.id || f?.rule || 'Hallazgo'}</div>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: passed ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: passed ? '#16a34a' : '#ef4444' }}
                            >
                              {passed ? 'OK' : 'Revisar'}
                            </span>
                          </div>
                          {f?.message || f?.description ? (
                            <div className="text-xs text-slate-600 mt-1 break-words">{f?.message || f?.description}</div>
                          ) : null}
                          {sev ? (
                            <div className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.06)', color }}>
                              Severidad: {f?.severity}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Derivados: Errores, Mejoras y Plan de acción */}
            {(() => {
              const d = deriveSecurityPlan(securityResult);
              return (
                <>
                  {(d.errors.length > 0 || d.improvements.length > 0 || d.plan.length > 0) && (
                    <SectionDivider label="Plan de acción" />
                  )}

                  {d.errors.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-red-700">Errores detectados</h3>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {d.errors.map((e) => (
                          <li key={e.id} dangerouslySetInnerHTML={{ __html: `<strong>${e.title}</strong>: ${e.recommendation}` }} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.improvements.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-amber-700">Mejoras recomendadas</h3>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {d.improvements.map((e) => (
                          <li key={e.id} dangerouslySetInnerHTML={{ __html: `<strong>${e.title}</strong>: ${e.recommendation}` }} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.plan.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Plan de acción</h3>
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        {d.plan.map((p) => (
                          <li key={p.id} className="break-words">{p.title} — <span className="text-slate-600">{p.recommendation}</span></li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              );
            })()}

            {!securityResult?.headers && !securityResult?.cookies && !Array.isArray(securityResult?.findings) && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(securityResult, null, 2)}</pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}