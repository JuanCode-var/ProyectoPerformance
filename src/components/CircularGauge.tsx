// src/components/CircularGauge.tsx
import React from "react";

export type CircularGaugeProps = {
  value?: number;       // valor actual
  max?: number;         // valor máximo (para % del arco)
  color?: string;       // color del trazo activo
  size?: number;        // tamaño del SVG (alto/ancho)
  strokeWidth?: number; // grosor del arco
  decimals?: number;    // decimales a mostrar en el número central
  suffix?: string;      // texto junto al número (p.ej. "s" o "%")
};

export default function CircularGauge({
  value = 0,
  max = 100,
  color = "#4ade80",
  size = 120,
  strokeWidth = 12,
  // nuevos props:
  decimals = 0, // cuántos decimales mostrar
  suffix = "",  // texto a la derecha del número (p. ej. "s" o "%")
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // protege división por 0/NaN:
  const safeMax = typeof max === "number" && max > 0 ? max : 100;
  const safeValue = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  const pct = Math.min(Math.max(safeValue / safeMax, 0), 1);
  const dash = pct * circumference;

  // render del valor
  const display =
    decimals > 0 ? safeValue.toFixed(decimals) : Math.round(safeValue).toString();

  return (
    <svg width={size} height={size} role="img" aria-label={`${display}${suffix}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="#ddd"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.25}
        fontWeight={700}
        fill="#111"
      >
        {display}
        {suffix}
      </text>
    </svg>
  );
}
