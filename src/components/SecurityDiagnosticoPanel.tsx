import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Button } from "../shared/ui/button";
import SecurityScoreWidget from "./SecurityScoreWidget";

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
};

const HEADER_INFO: Record<string, HeaderMeta> = {
  "content-security-policy": {
    title: "Content-Security-Policy (CSP)",
    description: "Controla qué recursos puede cargar la página para mitigar XSS.",
    recommendation: "Defina una política CSP restrictiva (evite 'unsafe-inline').",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    why: "Sin CSP, aplicaciones son más vulnerables a inyección de scripts.",
  },
  "strict-transport-security": {
    title: "Strict-Transport-Security (HSTS)",
    description: "Forza el uso de HTTPS para evitar ataques de downgrade.",
    recommendation: "Habilite HSTS con un max-age elevado y includeSubDomains si aplica.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    why: "Sin HSTS, usuarios pueden ser forzados a usar HTTP en ciertos ataques.",
  },
  "x-frame-options": {
    title: "X-Frame-Options",
    description: "Evita que la página sea embebida en iframes (clickjacking).",
    recommendation: "Use DENY o SAMEORIGIN según el caso.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    why: "Protege contra ataques de clickjacking.",
  },
  "x-content-type-options": {
    title: "X-Content-Type-Options",
    description: "Evita que el navegador haga MIME sniffing.",
    recommendation: "Use X-Content-Type-Options: nosniff.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
  },
  "referrer-policy": {
    title: "Referrer-Policy",
    description: "Controla cuánta información de referencia se envía.",
    recommendation: "Use 'strict-origin-when-cross-origin' o más restrictivo.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
  },
  "permissions-policy": {
    title: "Permissions-Policy",
    description: "Restringe APIs del navegador (geolocación, cámara, etc.).",
    recommendation: "Defina políticas por defecto lo más restrictivas posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy",
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

  const [showSecurityAbout, setShowSecurityAbout] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState<Record<string, boolean>>({});
  const hasRunRef = useRef(false);

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

  const handleSecurityDiagnostics = async () => {
    if (!url) return;
    setSecurityLoading(true);
    setSecurityError("");
    setSecurityResult(null);
    try {
      const res = await fetch("/api/security-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await safeParseJSON(res);
      if (!res.ok || data.error) throw new Error(data.error || "Error en el análisis de seguridad");
      setSecurityResult(data);
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
        {securityLoading && <div className="spinner" />}
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
                className="text-sm font-medium text-slate-700"
                onClick={() => setShowSecurityAbout((v) => !v)}
              >
                Acerca del análisis
              </button>
              {showSecurityAbout && (
                <p className="text-sm text-slate-600 mt-2">
                  El análisis revisa encabezados HTTP, cookies y hallazgos derivados. Proporciona
                  recomendaciones y un puntaje orientativo para ayudar a priorizar correcciones.
                </p>
              )}
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border p-4">
                <SecurityScoreWidget
                  score={securityResult?.score ?? securityResult?.securityScore ?? null}
                  grade={securityResult?.grade}
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
              <div>
                <h3 className="text-lg font-semibold mb-2">Encabezados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(securityResult.headers as Record<string, any>).map(([key, info]) => {
                    const normKey = String(key).toLowerCase();
                    const present = Boolean((info as any)?.present || (info as any)?.ok || (info as any)?.passed || (info as any)?.value != null);
                    const statusColor = present ? '#16a34a' : '#ef4444';
                    const statusText = present ? 'Presente' : 'Falta';
                    const detail = (info as any)?.message || (info as any)?.note || (info as any)?.expected || (info as any)?.value || '';
                    const meta = (HEADER_INFO as any)[normKey] as any;
                    const isExpanded = !!expandedHeaders[normKey];

                    return (
                      <div key={normKey} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium break-words">{normKey}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: present ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)', color: statusColor }}
                            >
                              {statusText}
                            </span>
                            <button className="text-xs text-slate-600 underline" onClick={() => toggleHeaderDetail(normKey)}>
                              Detalles
                            </button>
                          </div>
                        </div>

                        {detail ? (
                          <div className="text-xs text-slate-600 mt-1 break-words">{detail}</div>
                        ) : null}

                        {isExpanded && (
                          <div className="mt-2 text-xs bg-slate-50 border rounded p-2">
                            <div><strong>Por qué:</strong> {meta?.why ?? meta?.description ?? '—'}</div>
                            <div className="mt-1"><strong>Recomendación:</strong> {meta?.recommendation ?? meta?.suggestion ?? '—'}</div>
                            {meta?.learnMore && (
                              <div className="mt-1">
                                <a href={meta.learnMore} target="_blank" rel="noreferrer" className="text-blue-600 underline">Más info</a>
                              </div>
                            )}
                            {meta?.nginx && (
                              <div className="mt-2">
                                <div className="text-[11px] font-medium">nginx</div>
                                <pre className="text-xs bg-black text-white p-2 rounded mt-1">{meta.nginx}</pre>
                              </div>
                            )}
                            {meta?.apache && (
                              <div className="mt-2">
                                <div className="text-[11px] font-medium">Apache</div>
                                <pre className="text-xs bg-black text-white p-2 rounded mt-1">{meta.apache}</pre>
                              </div>
                            )}
                            {meta?.express && (
                              <div className="mt-2">
                                <div className="text-[11px] font-medium">Node / Express</div>
                                <pre className="text-xs bg-black text-white p-2 rounded mt-1">{meta.express}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cookies */}
            {securityResult?.cookies && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Cookies</h3>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-xs bg-slate-50 border rounded p-3">
                  {JSON.stringify(securityResult.cookies, null, 2)}
                </pre>
              </div>
            )}

            {/* Hallazgos */}
            {Array.isArray(securityResult?.findings) && securityResult.findings.length > 0 && (
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
            )}

            {/* Derivados: Errores, Mejoras y Plan de acción */}
            {(() => {
              const d = deriveSecurityPlan(securityResult);
              return (
                <>
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