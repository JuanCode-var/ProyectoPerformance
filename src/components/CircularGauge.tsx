import React from "react";

export type CircularGaugeProps = {
  value?: number;       // valor actual
  max?: number;         // valor máximo (para % del arco)
  color?: string;       // color del trazo activo
  size?: number;        // tamaño del SVG (alto/ancho)
  strokeWidth?: number; // grosor del arco
  decimals?: number;    // decimales a mostrar en el número central
  suffix?: string;      // texto junto al número (p.ej. "s" o "%")

  // extras no rompientes
  trackColor?: string;  // color del arco de fondo
  textColor?: string;   // color del número central
  rounded?: boolean;    // extremos redondeados
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
  trackColor = "#e5e7eb",
  textColor = "#111",
  rounded = true,
}: CircularGaugeProps) {
  const radius = Math.max((size - strokeWidth) / 2, 0);
  const circumference = 2 * Math.PI * radius;

  // protección anti NaN/0
  const safeMax =
    typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue =
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  // porcentaje de relleno (0..1)
  const pct = Math.min(Math.max(safeValue / safeMax, 0), 1);

  // Estrategia: dasharray = circunferencia completa; control con dashoffset
  const dashArray = `${circumference} ${circumference}`;
  const dashOffset = circumference * (1 - pct);

  // número centrado
  const display =
    typeof decimals === "number" && decimals > 0
      ? safeValue.toFixed(decimals)
      : Math.round(safeValue).toString();

  // Accesibilidad básica: tratamos el SVG como "medidor"
  const ariaLabel =
    suffix && suffix.trim().length
      ? `${display}${suffix}`
      : display;

  return (
    <svg
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* pista */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* progreso */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeDashoffset={dashOffset}
        strokeLinecap={rounded ? "round" : "butt"}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .45s ease" }}
      />
      {/* valor central */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.25}
        fontWeight={700}
        fill={textColor}
      >
        {display}
        {suffix ? (
          <tspan
            dx={size * 0.02}
            fontSize={size * 0.16}
            fontWeight={700}
            fill={textColor}
          >
            {suffix}
          </tspan>
        ) : null}
      </text>
      {/* título invisible para lectores (opcional, ayuda en tooltips nativos) */}
      <title>{ariaLabel}</title>
    </svg>
  );
}