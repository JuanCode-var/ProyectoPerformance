import React, { useMemo, useState, useEffect } from "react";

// Mini divisor similar al usado en DiagnosticoView
function MiniDivider({ label }: { label: string }) {
  return (
    <div style={{ width: '100%', margin: '10px 0' }} role="separator" aria-label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, #cbd5e1 50%, rgba(0,0,0,0) 100%)' }} />
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', padding: '2px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>{label}</div>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, #cbd5e1 50%, rgba(0,0,0,0) 100%)' }} />
      </div>
    </div>
  );
}

export default function SecurityScoreWidget({
  score,
  grade,
  history,
  topFindings,
}: {
  score: number | null | undefined;
  grade?: string | null;
  history?: Array<{ fecha: string | number | Date; score: number | null }>;
  topFindings?: Array<{ id: string; title: string; severity: string }>;
}) {
  const s = typeof score === "number" ? Math.max(0, Math.min(100, Math.round(score))) : null;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (s == null) return setAnimated(0);
    let raf: number;
    const start = performance.now();
    const from = 0;
    const to = s;
    const dur = 800;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setAnimated(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s]);

  const computeGrade = (v: number | null | undefined) => {
    if (v == null) return { g: "-", text: "Sin datos" };
    if (v >= 90) return { g: "A", text: "Excelente — prácticas de seguridad bien aplicadas." };
    if (v >= 75) return { g: "B", text: "Bueno — algunas mejoras recomendadas." };
    if (v >= 50) return { g: "C", text: "C — necesita atención: faltan encabezados críticos o hay hallazgos." };
    if (v >= 25) return { g: "D", text: "Débil — muchas configuraciones faltantes." };
    return { g: "F", text: "Muy débil — riesgo elevado, requiere intervención urgente." };
  };

  const info = computeGrade(s);
  const [showTip, setShowTip] = useState(false);

  // Gauge geometry
  const R = 42;
  const C = 2 * Math.PI * R;
  const pct = (animated / 100) * C;
  const remainder = Math.max(0, C - pct);

  const gaugeColor = useMemo(() => {
    const v = s ?? 0;
    if (v >= 90) return "#16a34a";
    if (v >= 75) return "#22c55e";
    if (v >= 50) return "#f59e0b";
    if (v >= 25) return "#ef4444";
    return "#7f1d1d";
  }, [s]);

  // Simple sparkline (history) when provided
  const sparkPoints = useMemo(() => {
    const points = (history || []).filter(h => typeof h.score === 'number');
    if (!points.length) return null;
    const vals = points.map(p => Math.max(0, Math.min(100, Math.round(p.score as number))));
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 100);
    const W = 160;
    const H = 36;
    const step = vals.length > 1 ? W / (vals.length - 1) : 0;
    const ys = vals.map(v => {
      const t = (v - min) / Math.max(1, (max - min));
      return H - t * H;
    });
    const path = ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${y}`).join(' ');
    return { path, W, H };
  }, [history]);

  // Pick top critical findings to show as mini list
  const topItems = useMemo(() => {
    const list = (topFindings || []).filter(f => f && f.title).slice(0, 3);
    return list.map(f => ({
      ...f,
      color: f.severity === 'critical' ? '#dc2626' : f.severity === 'warning' ? '#f59e0b' : '#64748b'
    }));
  }, [topFindings]);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        role="img"
        aria-label={`Calificación de seguridad ${s ?? "sin datos"}`}
        style={{
          width: 120,
          height: 120,
          borderRadius: 12,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #e6e6e6",
          position: "relative",
          cursor: "default",
        }}
      >
        <svg width={110} height={110} viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx="55" cy="55" r={R} stroke="#e5e7eb" strokeWidth="10" fill="none" />
          {/* Progress: color sólido alineado a la leyenda */}
          <circle
            cx="55"
            cy="55"
            r={R}
            stroke={gaugeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={remainder}
            fill="none"
          />
          {/* Tick marks every 10% */}
          {[...Array(10)].map((_, i) => (
            <line
              key={i}
              x1="55"
              y1="9"
              x2="55"
              y2="13"
              stroke="#cbd5e1"
              strokeWidth="2"
              transform={`rotate(${i * 36}, 55, 55)`}
            />
          ))}
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{s == null ? "—" : animated}</div>
        </div>

        {showTip && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: 8,
            background: "#111827",
            color: "#fff",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            whiteSpace: "nowrap",
            zIndex: 40,
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)"
          }}>
            {info.text}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
          Calificación de seguridad {s == null ? "" : `— ${info.g}`}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            {/* Inline mini bar */}
            <div style={{ height: 10, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }} aria-hidden>
              <div style={{ width: `${s ?? 0}%`, height: "100%", background: gaugeColor }} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{info.text}</div>

            {/* Sparkline history */}
            {sparkPoints && (
              <div style={{ marginTop: 10 }}>
                <MiniDivider label="Historial" />
                <svg width={sparkPoints.W} height={sparkPoints.H} viewBox={`0 0 ${sparkPoints.W} ${sparkPoints.H}`}>
                  <path d={sparkPoints.path} fill="none" stroke="#2563eb" strokeWidth={1.5} />
                </svg>
              </div>
            )}
          </div>

          <div style={{ minWidth: 200, fontSize: 12, color: "#475569" }}>
            <MiniDivider label="Leyenda" />
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
              <span style={{ width: 10, height: 10, background: "#16a34a", borderRadius: 2 }} /> <span>90-100 A</span>
              <span style={{ width: 10, height: 10, background: "#22c55e", borderRadius: 2 }} /> <span>75-89 B</span>
              <span style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: 2 }} /> <span>50-74 C</span>
              <span style={{ width: 10, height: 10, background: "#ef4444", borderRadius: 2 }} /> <span>25-49 D</span>
              <span style={{ width: 10, height: 10, background: "#7f1d1d", borderRadius: 2 }} /> <span>0-24 F</span>
            </div>

            {/* Top issues */}
            {topItems.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <MiniDivider label="Principales hallazgos" />
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                  {topItems.map((it) => (
                    <li key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, background: it.color, borderRadius: 999 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}