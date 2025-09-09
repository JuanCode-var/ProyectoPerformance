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
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Gauge principal con diseño mejorado */}
        <div className="relative flex-shrink-0">
          <div
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            role="img"
            aria-label={`Calificación de seguridad ${s ?? "sin datos"}`}
            className="relative w-32 h-32 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center cursor-default group hover:shadow-xl transition-all duration-300"
          >
            {/* Efecto de resplandor basado en la puntuación */}
            <div 
              className="absolute inset-0 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity"
              style={{ 
                background: `radial-gradient(circle at center, ${gaugeColor}20 0%, transparent 70%)`,
                filter: `drop-shadow(0 0 20px ${gaugeColor}40)`
              }}
            />
            
            <svg width={110} height={110} viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
              {/* Track con gradiente sutil */}
              <circle cx="55" cy="55" r={R} stroke="url(#trackGradient)" strokeWidth="8" fill="none" />
              
              {/* Progress con gradiente dinámico */}
              <circle
                cx="55"
                cy="55"
                r={R}
                stroke="url(#progressGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${C} ${C}`}
                strokeDashoffset={remainder}
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
              
              {/* Gradientes definidos */}
              <defs>
                <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f1f5f9" />
                  <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gaugeColor} />
                  <stop offset="100%" stopColor={gaugeColor + '80'} />
                </linearGradient>
              </defs>
              
              {/* Tick marks mejorados */}
              {[...Array(10)].map((_, i) => (
                <line
                  key={i}
                  x1="55"
                  y1="8"
                  x2="55"
                  y2="14"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  transform={`rotate(${i * 36}, 55, 55)`}
                />
              ))}
            </svg>

            {/* Valor central con animación mejorada */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-slate-900 mb-1 transition-all duration-300">
                {s == null ? "—" : animated}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: gaugeColor }}>
                {info.g}
              </div>
            </div>

            {/* Tooltip mejorado */}
            {showTip && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 z-50">
                <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl">
                  {info.text}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Calificación de Seguridad {s != null && `— Grado ${info.g}`}
            </h3>
            
            {/* Barra de progreso horizontal con gradiente */}
            <div className="relative h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ 
                  width: `${s ?? 0}%`, 
                  background: `linear-gradient(90deg, ${gaugeColor}, ${gaugeColor}cc)`,
                  boxShadow: `0 0 10px ${gaugeColor}40`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{info.text}</p>
          </div>

          {/* Sparkline history mejorado */}
          {sparkPoints && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                📊 Evolución Histórica
              </h4>
              <div className="relative">
                <svg width={sparkPoints.W} height={sparkPoints.H} viewBox={`0 0 ${sparkPoints.W} ${sparkPoints.H}`} className="w-full h-auto">
                  {/* Área bajo la curva */}
                  <defs>
                    <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f650" />
                      <stop offset="100%" stopColor="#3b82f610" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkPoints.path} L ${sparkPoints.W} ${sparkPoints.H} L 0 ${sparkPoints.H} Z`} fill="url(#sparklineGradient)" />
                  <path d={sparkPoints.path} fill="none" stroke="#3b82f6" strokeWidth={2} />
                  {/* Puntos en la línea */}
                  {sparkPoints.path.split(' ').filter((_, i) => i % 3 === 1).map((point, i) => (
                    <circle key={i} cx={point} cy={sparkPoints.path.split(' ')[i * 3 + 2]} r="2" fill="#3b82f6" />
                  ))}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral con información adicional */}
        <div className="w-full lg:w-64 space-y-4">
          {/* Leyenda mejorada */}
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              🎯 Escala de Calificación
            </h4>
            <div className="space-y-2">
              {[
                { range: "90-100", grade: "A", color: "#16a34a", label: "Excelente" },
                { range: "75-89", grade: "B", color: "#22c55e", label: "Bueno" },
                { range: "50-74", grade: "C", color: "#f59e0b", label: "Regular" },
                { range: "25-49", grade: "D", color: "#ef4444", label: "Débil" },
                { range: "0-24", grade: "F", color: "#7f1d1d", label: "Crítico" }
              ].map((item) => (
                <div key={item.grade} className="flex items-center gap-3 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm shadow-sm" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono text-slate-600 min-w-0">{item.range}</span>
                  <span className="font-bold" style={{ color: item.color }}>{item.grade}</span>
                  <span className="text-slate-500 truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Principales hallazgos mejorados */}
          {topItems.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                ⚠️ Principales Hallazgos
              </h4>
              <ul className="space-y-2">
                {topItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div 
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">{item.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}