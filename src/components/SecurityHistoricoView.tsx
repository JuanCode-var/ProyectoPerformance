// src/components/SecurityHistoricoView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Button } from "../shared/ui/button";
import { type SecurityHistoryPoint } from "./SecurityHistoryChart";

function useQuery(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

async function safeParse(res: Response): Promise<any> {
  const txt = await res.text();
  try { return JSON.parse(txt || "{}"); } catch { return { _raw: txt }; }
}

// Simple, readable SVG line/area chart for 0..100 scores with grid + tooltips
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
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${path} L${xs[xs.length-1]},${padding.top + innerH} L${xs[0]},${padding.top + innerH} Z`;

  const ticks = [0, 25, 50, 75, 100];

  // deltas vs previous point
  const deltas: Array<number | null> = points.map((p, i) => (i === 0 ? null : points[i].score - points[i-1].score));

  const [hover, setHover] = useState<number | null>(null);
  const idx = hover ?? (points.length - 1);
  const hoverX = xs[idx];
  const hoverY = ys[idx];
  const hoverPt = points[idx];
  const hoverDelta = deltas[idx];

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ minWidth: width }}>
        {/* Header stats */}
        <div className="text-sm text-slate-700 mb-2 flex flex-wrap gap-4">
          <div>
            <span className="font-semibold">Promedio:</span> {Math.round(points.reduce((a,b)=>a+b.score,0)/points.length)}
          </div>
          <div>
            <span className="font-semibold">Mín:</span> {Math.min(...points.map(p=>p.score))}
          </div>
          <div>
            <span className="font-semibold">Máx:</span> {Math.max(...points.map(p=>p.score))}
          </div>
        </div>

        <svg width={width} height={height} role="img" aria-label="Histórico de seguridad (línea)">
          {/* Grid */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={yFor(t)} y2={yFor(t)} stroke="#e5e7eb" strokeDasharray="4 4" />
              <text x={8} y={yFor(t) + 4} fontSize={11} fill="#64748b">{t}</text>
            </g>
          ))}

          {/* Area under curve */}
          <path d={area} fill="#93c5fd" fillOpacity={0.22} />
          {/* Line */}
          <path d={path} fill="none" stroke="#2563eb" strokeWidth={2.5} />

          {/* Points + labels */}
          {xs.map((x, i) => (
            <g key={i}>
              <circle cx={x} cy={ys[i]} r={4} fill="#2563eb">
                <title>{`Score: ${points[i].score}\nFecha: ${points[i].date.toLocaleString()}${deltas[i] == null ? "" : `\nΔ vs ant.: ${deltas[i] > 0 ? "+" : ""}${deltas[i].toFixed(0)}`}`}</title>
              </circle>
              {/* score label above point */}
              <text x={x} y={ys[i] - 8} fontSize={11} fontWeight={600} fill="#0f172a" textAnchor="middle">{points[i].score}</text>
            </g>
          ))}

          {/* Interactive hover zones */}
          {xs.map((x, i) => (
            <rect key={`hz-${i}`} x={x - step/2} y={padding.top} width={step} height={innerH} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}

          {/* Hover marker */}
          {idx != null && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={padding.top} y2={padding.top + innerH} stroke="#94a3b8" strokeDasharray="3 3" />
              <circle cx={hoverX} cy={hoverY} r={5} fill="#1d4ed8" stroke="#fff" strokeWidth={2} />
            </g>
          )}

          {/* X labels with date + time */}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.floor(points.length / 10)) === 0 || i === points.length - 1;
            if (!show) return null;
            const lbl = p.date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
            return (
              <text key={`xl-${i}`} x={xs[i]} y={padding.top + innerH + 24} fontSize={11} fill="#475569" textAnchor="middle">{lbl}</text>
            );
          })}

          {/* Tooltip (score + fecha + delta) */}
          {hoverPt && (
            <g transform={`translate(${hoverX + 8}, ${Math.max(hoverY - 44, padding.top + 6)})`}>
              <rect width="230" height="40" rx="6" ry="6" fill="#0f172a" opacity={0.9} />
              <text x={10} y={18} fontSize={12} fill="#fff">
                {`Score ${hoverPt.score} — ${hoverPt.date.toLocaleString()}`}
              </text>
              <text x={10} y={33} fontSize={12} fill="#fff">
                {hoverDelta == null ? "Inicio de serie" : `Δ vs anterior: ${hoverDelta > 0 ? "+" : ""}${hoverDelta.toFixed(0)}`}
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

  const [history, setHistory] = useState<SecurityHistoryPoint[] | null>(null);
  const [err, setErr] = useState<string>("");

  if (!url) return <Navigate to="/" replace />;

  useEffect(() => {
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
  }, [url]);

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
              <h3 className="text-lg font-semibold">Evolución del score de seguridad</h3>
            </div>
            {/* Nueva gráfica funcional */}
            <SecurityHistoryLineChart data={history} height={420} />

            {/* Tabla comparativa de mediciones */}
            {(() => {
              // preparar deltas vs medición anterior (orden cronológico asc)
              const asc = [...history].sort((a,b)=> new Date(a.fecha as any).getTime() - new Date(b.fecha as any).getTime());
              const deltasMap = new Map<number, number | null>();
              for (let i=0;i<asc.length;i++) {
                const ts = new Date(asc[i].fecha as any).getTime();
                const prev = i>0 ? asc[i-1] : null;
                const d = prev && typeof asc[i].score === 'number' && typeof prev.score === 'number'
                  ? (asc[i].score as number) - (prev.score as number)
                  : null;
                deltasMap.set(ts, d);
              }
              const desc = [...asc].reverse();
              return (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-600 border-b">
                        <th className="py-2 pr-4">Fecha y hora</th>
                        <th className="py-2 pr-4">Score</th>
                        <th className="py-2 pr-4">Δ vs anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desc.map((row, i) => {
                        const ts = new Date(row.fecha as any).getTime();
                        const d = deltasMap.get(ts);
                        const color = d == null ? '#64748b' : d > 0 ? '#16a34a' : d < 0 ? '#ef4444' : '#64748b';
                        const sign = d == null ? '' : d > 0 ? '+' : '';
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 pr-4 whitespace-nowrap">{new Date(row.fecha as any).toLocaleString()}</td>
                            <td className="py-2 pr-4 font-medium">{row.score ?? '—'}</td>
                            <td className="py-2 pr-4" style={{ color }}>{d == null ? '—' : `${sign}${d.toFixed(0)}`}</td>
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
