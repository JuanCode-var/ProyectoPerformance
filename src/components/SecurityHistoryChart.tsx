import React from "react";

export type SecurityHistoryPoint = { fecha: string | number | Date; score: number | null };

type Props = {
  data: SecurityHistoryPoint[];
  height?: number; // total chart container height (including axes), default 220
  barWidth?: number; // fixed bar width; otherwise auto based on data length
  showAxis?: boolean; // show x/y axis labels
  ariaLabel?: string;
  onBarClick?: (point: { date: Date; score: number; index: number }) => void; // optional
};

export default function SecurityHistoryChart({ data, height = 220, barWidth, showAxis = true, ariaLabel = "Histórico de seguridad", onBarClick }: Props) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const points = data.map((d) => ({
    date: new Date(d.fecha),
    score: typeof d.score === "number" && !Number.isNaN(d.score) ? Math.max(0, Math.min(100, d.score)) : 0,
  }));

  const max = 100; // score escala 0..100
  const innerH = Math.max(120, height - (showAxis ? 40 : 10));
  const autoBarW = Math.max(14, Math.floor(600 / Math.max(4, points.length)));
  const bw = Math.max(10, barWidth ?? autoBarW);

  return (
    <div style={{ width: "100%", overflowX: "auto" }} role="img" aria-label={ariaLabel}>
      <div style={{ minWidth: Math.max(640, points.length * (bw + 10) + 40) }}>
        {/* Chart area */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: innerH, padding: "12px 8px", borderLeft: showAxis ? "1px solid #e5e7eb" : undefined, borderBottom: showAxis ? "1px solid #e5e7eb" : undefined }}>
          {points.map((p, i) => {
            const h = (p.score / max) * (innerH - 24) + 8; // margen top
            const shortLabel = p.date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
            const fullLabel = `${p.date.toLocaleDateString()} ${p.date.toLocaleTimeString()}`;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  title={`Score: ${p.score}\nFecha: ${fullLabel}`}
                  style={{ width: bw, height: h, background: "#2563EB", borderRadius: 6, cursor: onBarClick ? "pointer" : "default" }}
                  onClick={onBarClick ? () => onBarClick({ date: p.date, score: p.score, index: i }) : undefined}
                />
                {showAxis && <div style={{ fontSize: 11, color: "#475569" }}>{shortLabel}</div>}
              </div>
            );
          })}
        </div>
        {showAxis && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", padding: "6px 6px 0" }}>
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        )}
      </div>
    </div>
  );
}
