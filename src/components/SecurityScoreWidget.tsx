import React, { useState } from "react";

export default function SecurityScoreWidget({
  score,
  grade,
}: {
  score: number | null | undefined;
  grade?: string | null;
}) {
  const s = typeof score === "number" ? Math.max(0, Math.min(100, Math.round(score))) : null;

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

  const barColor = s == null ? "#cbd5e1" : s >= 90 ? "#16a34a" : s >= 75 ? "#f59e0b" : s >= 50 ? "#ef4444" : "#7f1d1d";

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        aria-hidden
        style={{
          width: 96,
          height: 96,
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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: "#0f172a" }}>{s == null ? "—" : s}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>%</div>
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
            <div style={{ height: 10, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ width: `${s ?? 0}%`, height: "100%", background: barColor }} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{info.text}</div>
          </div>

          <div style={{ minWidth: 120, textAlign: "right", fontSize: 12, color: "#475569" }}>
            <div>Interactividad</div>
            <div style={{ marginTop: 6, color: "#2563eb" }}>Pasa el cursor sobre el número para ver la explicación</div>
          </div>
        </div>
      </div>
    </div>
  );
}