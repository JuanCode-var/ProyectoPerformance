// src/components/SecurityHistoricoView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Button } from "../shared/ui/button";
import { useAuth } from '../auth/AuthContext';
import { Ban } from 'lucide-react';

export type SecurityHistoryPoint = { fecha: string | number | Date; score: number | null };

function useQuery(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

function loadUiFlagShowSecurityHistory(): boolean {
  try {
    const raw = localStorage.getItem('app.settings');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.ui?.showSecurityHistoryToClients);
  } catch { return false; }
}

async function safeParse(res: Response): Promise<any> {
  const txt = await res.text();
  try { return JSON.parse(txt || "{}"); } catch { return { _raw: txt }; }
}

// Goal-focused comparative chart for security scores with target lines and performance indicators
function SecurityHistoryLineChart({ data, height = 420 }: { data: SecurityHistoryPoint[]; height?: number }) {
  const points = useMemo(() => {
    const arr = (data || []).map((d) => ({
      date: new Date(d.fecha as any),
      score: typeof d.score === "number" && !Number.isNaN(d.score) ? Math.max(0, Math.min(100, d.score)) : null,
    })).filter((d) => d.score !== null) as { date: Date; score: number }[];
    return arr.sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  if (!points.length) return <p>No hay datos válidos para graficar.</p>;

  const padding = { top: 24, right: 32, bottom: 60, left: 44 };
  const step = Math.max(48, Math.floor(700 / Math.max(4, points.length)));
  const width = Math.max(860, padding.left + padding.right + (points.length - 1) * step);
  const innerH = Math.max(220, height - padding.top - padding.bottom);
  const yFor = (s: number) => padding.top + (100 - s) / 100 * innerH; // 0..100 → y

  const xs: number[] = points.map((_, i) => padding.left + i * step);
  const ys: number[] = points.map((p) => yFor(p.score));
  
  // Goal/target definitions for security
  const excellentTarget = 90;
  const goodTarget = 75;
  const acceptableTarget = 60;
  
  // Calculate metrics for comparison
  const average = Math.round(points.reduce((a,b)=>a+b.score,0)/points.length);
  const min = Math.min(...points.map(p=>p.score));
  const max = Math.max(...points.map(p=>p.score));
  const latest = points[points.length - 1]?.score || 0;
  const trend = points.length > 1 ? latest - points[0].score : 0;
  
  // Deltas vs previous point
  const deltas: Array<number | null> = points.map((p, i) => (i === 0 ? null : points[i].score - points[i-1].score));
  
  // Performance zones
  const zones = [
    { min: excellentTarget, max: 100, color: "#16a34a", label: "Excelente", opacity: 0.1 },
    { min: goodTarget, max: excellentTarget, color: "#eab308", label: "Bueno", opacity: 0.08 },
    { min: acceptableTarget, max: goodTarget, color: "#f97316", label: "Aceptable", opacity: 0.06 },
    { min: 0, max: acceptableTarget, color: "#ef4444", label: "Crítico", opacity: 0.04 }
  ];

  const [hover, setHover] = useState<number | null>(null);
  const idx = hover ?? (points.length - 1);
  const hoverX = xs[idx];
  const hoverY = ys[idx];
  const hoverPt = points[idx];
  const hoverDelta = deltas[idx];

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ minWidth: width }}>
        {/* Header stats with goal comparison */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <div className="text-lg font-bold text-slate-900">{latest}</div>
            <div className="text-xs text-slate-600">Actual</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <div className="text-lg font-bold text-slate-900">{average}</div>
            <div className="text-xs text-slate-600">Promedio</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <div className={`text-lg font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(0)}
            </div>
            <div className="text-xs text-slate-600">Tendencia</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50">
            <div className="text-lg font-bold text-blue-600">{excellentTarget}</div>
            <div className="text-xs text-slate-600">Meta</div>
          </div>
        </div>

        {/* Performance indicator */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Estado actual:</span>
          {latest >= excellentTarget && <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">🎯 Excelente</span>}
          {latest >= goodTarget && latest < excellentTarget && <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">👍 Bueno</span>}
          {latest >= acceptableTarget && latest < goodTarget && <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">⚠️ Aceptable</span>}
          {latest < acceptableTarget && <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">🚨 Crítico</span>}
        </div>

        <svg width={width} height={height} role="img" aria-label="Histórico de seguridad comparativo">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.05"/>
            </linearGradient>
          </defs>

          {/* Performance zones background */}
          {zones.map((zone, i) => (
            <rect key={i} 
              x={padding.left} 
              y={yFor(zone.max)} 
              width={width - padding.left - padding.right} 
              height={yFor(zone.min) - yFor(zone.max)} 
              fill={zone.color} 
              fillOpacity={zone.opacity} 
            />
          ))}

          {/* Target lines */}
          <g>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(excellentTarget)} y2={yFor(excellentTarget)} 
              stroke="#16a34a" strokeWidth="2" strokeDasharray="8 4" />
            <text x={width - padding.right + 4} y={yFor(excellentTarget) + 4} fontSize={11} fill="#16a34a" fontWeight="600">Meta {excellentTarget}</text>
            
            <line x1={padding.left} x2={width - padding.right} y1={yFor(goodTarget)} y2={yFor(goodTarget)} 
              stroke="#eab308" strokeWidth="1.5" strokeDasharray="6 3" />
            <text x={width - padding.right + 4} y={yFor(goodTarget) + 4} fontSize={10} fill="#eab308">Bueno {goodTarget}</text>
            
            <line x1={padding.left} x2={width - padding.right} y1={yFor(acceptableTarget)} y2={yFor(acceptableTarget)} 
              stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2" />
            <text x={width - padding.right + 4} y={yFor(acceptableTarget) + 4} fontSize={10} fill="#f97316">Mín {acceptableTarget}</text>
          </g>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((t, i) => (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={yFor(t)} y2={yFor(t)} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={8} y={yFor(t) + 4} fontSize={11} fill="#64748b">{t}</text>
            </g>
          ))}

          {/* Area under curve with gradient */}
          <path d={`${xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")} L${xs[xs.length-1]},${padding.top + innerH} L${xs[0]},${padding.top + innerH} Z`} 
            fill="url(#areaGradient)" />

          {/* Main line */}
          <path d={xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")} 
            fill="none" stroke="#2563eb" strokeWidth={3} />

          {/* Data points with conditional colors based on performance */}
          {xs.map((x, i) => {
            const score = points[i].score;
            const pointColor = score >= excellentTarget ? "#16a34a" : 
                             score >= goodTarget ? "#eab308" : 
                             score >= acceptableTarget ? "#f97316" : "#ef4444";
            const delta = deltas[i];
            const deltaColor = delta === null ? pointColor : delta > 0 ? "#16a34a" : delta < 0 ? "#ef4444" : pointColor;
            
            return (
              <g key={i}>
                <circle cx={x} cy={ys[i]} r={5} fill={pointColor} stroke="#fff" strokeWidth="2">
                  <title>{`Score: ${score}\nFecha: ${points[i].date.toLocaleString()}${delta == null ? "" : `\nΔ vs ant.: ${delta > 0 ? "+" : ""}${delta.toFixed(0)}`}`}</title>
                </circle>
                {/* Score label with background */}
                <rect x={x - 12} y={ys[i] - 20} width="24" height="14" rx="2" fill="#fff" stroke="#e5e7eb" />
                <text x={x} y={ys[i] - 10} fontSize={10} fontWeight="600" fill="#0f172a" textAnchor="middle">{score}</text>
                
                {/* Delta indicator for non-first points */}
                {delta !== null && (
                  <text x={x} y={ys[i] + 18} fontSize={9} fill={deltaColor} textAnchor="middle" fontWeight="500">
                    {delta > 0 ? "↗" : delta < 0 ? "↘" : "→"}{Math.abs(delta)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Interactive hover zones */}
          {xs.map((x, i) => (
            <rect key={`hz-${i}`} x={x - step/2} y={padding.top} width={step} height={innerH} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}

          {/* Hover marker */}
          {hover !== null && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={padding.top} y2={padding.top + innerH} stroke="#1d4ed8" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx={hoverX} cy={hoverY} r={7} fill="#1d4ed8" stroke="#fff" strokeWidth="3" />
            </g>
          )}

          {/* X labels with date + time */}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.floor(points.length / 8)) === 0 || i === points.length - 1;
            if (!show) return null;
            const lbl = p.date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
            return (
              <text key={`xl-${i}`} x={xs[i]} y={padding.top + innerH + 24} fontSize={11} fill="#475569" textAnchor="middle">{lbl}</text>
            );
          })}

          {/* Enhanced tooltip */}
          {hover !== null && hoverPt && (
            <g transform={`translate(${Math.min(hoverX + 12, width - 280)}, ${Math.max(hoverY - 60, padding.top + 6)})`}>
              <rect width="270" height="55" rx="8" ry="8" fill="#0f172a" opacity={0.95} />
              <text x={12} y={18} fontSize={12} fill="#fff" fontWeight="600">
                Score {hoverPt.score} — {hoverPt.date.toLocaleDateString()}
              </text>
              <text x={12} y={33} fontSize={11} fill="#94a3b8">
                {hoverPt.date.toLocaleTimeString()} • {hoverDelta == null ? "Inicio de serie" : `Cambio: ${hoverDelta > 0 ? "+" : ""}${hoverDelta.toFixed(0)}`}
              </text>
              <text x={12} y={47} fontSize={11} fill={hoverPt.score >= excellentTarget ? "#22c55e" : hoverPt.score >= goodTarget ? "#eab308" : hoverPt.score >= acceptableTarget ? "#fb923c" : "#ef4444"}>
                {hoverPt.score >= excellentTarget ? "🎯 Excelente" : hoverPt.score >= goodTarget ? "👍 Bueno" : hoverPt.score >= acceptableTarget ? "⚠️ Aceptable" : "🚨 Crítico"}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function SecurityHistoricoView() {
  const query = useQuery();
  const url = query.get("url") || "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCliente = user?.role === 'cliente';
  const allowedForClient = !isCliente || loadUiFlagShowSecurityHistory();

  const [history, setHistory] = useState<SecurityHistoryPoint[] | null>(null);
  const [err, setErr] = useState<string>("");

  if (!url) return <Navigate to="/" replace />;

  useEffect(() => {
    if (!allowedForClient) return; // respetar flag desde settings
    (async () => {
      try {
        const r = await fetch(`/api/security/history?url=${encodeURIComponent(url)}`);
        const data = await safeParse(r);
        if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
        const mapped: SecurityHistoryPoint[] = Array.isArray(data)
          ? data.map((d: any) => ({ fecha: d.fecha, score: typeof d.score === "number" ? d.score : null }))
          : [];
        setHistory(mapped);
      } catch (e: any) {
        setErr(e?.message || "Error cargando histórico de seguridad");
      }
    })();
  }, [url, allowedForClient]);

  if (!allowedForClient) return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Histórico de seguridad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-slate-600 mb-3">
          <Ban size={18} />
          <span>El administrador ha restringido el histórico de seguridad para clientes.</span>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)} className="back-link">Volver al diagnóstico</Button>
      </CardContent>
    </Card>
  );

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Histórico de seguridad</CardTitle>
      </CardHeader>
      <CardContent>
        {/* ÚNICO botón: volver al diagnóstico (mismo estilo que Diagnóstico) */}
        <div style={{ marginBottom: 16 }}>
          <Button variant="outline" onClick={() => navigate(-1)} className="back-link">Volver al diagnóstico</Button>
        </div>

        <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>

        {err && <p className="error">{err}</p>}
        {history === null && (
          <div className="spinner" style={{ margin: "12px 0" }} />
        )}
        {history && history.length === 0 && (
          <p>No hay registros de seguridad para esta URL.</p>
        )}

        {history && history.length > 0 && (
          <div className="rounded-lg border p-3 mt-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Análisis de Performance de Seguridad</h3>
            </div>
            {/* Nueva gráfica comparativa y orientada a objetivos */}
            <SecurityHistoryLineChart data={history} height={420} />

            {/* Tabla comparativa mejorada con objetivos */}
            {(() => {
              // preparar deltas vs medición anterior (orden cronológico asc)
              const asc = [...history].sort((a,b)=> new Date(a.fecha as any).getTime() - new Date(b.fecha as any).getTime());
              const deltasMap = new Map<number, { delta: number | null; status: string; trend: string }>();
              
              // Definir objetivos
              const excellentTarget = 90;
              const goodTarget = 75;
              const acceptableTarget = 60;
              
              for (let i=0;i<asc.length;i++) {
                const ts = new Date(asc[i].fecha as any).getTime();
                const current = asc[i].score as number;
                const prev = i>0 ? asc[i-1] : null;
                const delta = prev && typeof current === 'number' && typeof prev.score === 'number'
                  ? current - (prev.score as number)
                  : null;
                
                const status = current >= excellentTarget ? 'Excelente' : 
                              current >= goodTarget ? 'Bueno' : 
                              current >= acceptableTarget ? 'Aceptable' : 'Crítico';
                
                const trend = delta === null ? 'Inicial' : delta > 0 ? 'Mejora' : delta < 0 ? 'Deterioro' : 'Estable';
                
                deltasMap.set(ts, { delta, status, trend });
              }
              
              const desc = [...asc].reverse();
              
              return (
                <div className="mt-4 overflow-x-auto">
                  <div className="mb-3 text-sm text-slate-600">
                    <strong>Objetivos:</strong> Excelente ≥90 • Bueno ≥75 • Aceptable ≥60 • Crítico &lt;60
                  </div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-600 border-b bg-slate-50">
                        <th className="py-3 px-3">Fecha y hora</th>
                        <th className="py-3 px-3">Score</th>
                        <th className="py-3 px-3">Estado</th>
                        <th className="py-3 px-3">Tendencia</th>
                        <th className="py-3 px-3">Dist. a Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desc.map((row, i) => {
                        const ts = new Date(row.fecha as any).getTime();
                        const info = deltasMap.get(ts);
                        const score = row.score as number;
                        const distToTarget = excellentTarget - score;
                        
                        const statusColors: Record<string, string> = {
                          'Excelente': 'text-green-700 bg-green-50',
                          'Bueno': 'text-yellow-700 bg-yellow-50',
                          'Aceptable': 'text-orange-700 bg-orange-50',
                          'Crítico': 'text-red-700 bg-red-50'
                        };
                        
                        const trendColors: Record<string, string> = {
                          'Mejora': 'text-green-600',
                          'Deterioro': 'text-red-600',
                          'Estable': 'text-slate-600',
                          'Inicial': 'text-slate-500'
                        };
                        
                        const trendIcons: Record<string, string> = {
                          'Mejora': '📈',
                          'Deterioro': '📉',
                          'Estable': '➡️',
                          'Inicial': '🏁'
                        };
                        
                        const status = info?.status || 'Crítico';
                        const trend = info?.trend || 'Inicial';
                        
                        return (
                          <tr key={i} className="border-b last:border-0 hover:bg-slate-25">
                            <td className="py-2 px-3 whitespace-nowrap">{new Date(row.fecha as any).toLocaleString()}</td>
                            <td className="py-2 px-3 font-bold text-lg">{score}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                                {status}
                              </span>
                            </td>
                            <td className={`py-2 px-3 font-medium ${trendColors[trend]}`}>
                              {trendIcons[trend]} {trend}
                              {info?.delta !== null && info?.delta !== 0 && info?.delta !== undefined && (
                                <span className="ml-1 text-xs">
                                  ({info.delta > 0 ? '+' : ''}{info.delta})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {distToTarget <= 0 ? (
                                <span className="text-green-600 font-medium">🎯 Meta alcanzada</span>
                              ) : (
                                <span className="text-slate-600">-{distToTarget} pts</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
