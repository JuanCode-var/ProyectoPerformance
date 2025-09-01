import React from "react"

export type CircularGaugeProps = {
  value?: number
  max?: number
  color?: string
  size?: number
  strokeWidth?: number
  decimals?: number
  suffix?: string
  trackColor?: string
  textColor?: string
  rounded?: boolean

  // NUEVO
  showValue?: boolean              // si false, no dibuja el <text> central
  centerFill?: string              // color de relleno del centro (p.ej. "rgba(...)")
  centerRadiusPct?: number         // radio del círculo central relativo (0..1), default 0.78

  className?: string
  style?: React.CSSProperties
  title?: string
}

export default function CircularGauge({
  value = 0,
  max = 100,
  color = "#4ade80",
  size = 120,
  strokeWidth = 12,
  decimals = 0,
  suffix = "",
  trackColor = "#e5e7eb",
  textColor = "#111",
  rounded = true,

  // NUEVO
  showValue = true,
  centerFill,
  centerRadiusPct = 0.78,

  className,
  style,
  title,
}: CircularGaugeProps) {
  const radius = Math.max((size - strokeWidth) / 2, 0)
  const circumference = 2 * Math.PI * radius

  // círculo central opcional
  const innerR = Math.max(
    radius * Math.min(Math.max(centerRadiusPct, 0.1), 0.95),
    0
  )

  const safeMax =
    typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 100
  const safeValue =
    typeof value === "number" && Number.isFinite(value) ? value : 0

  const pct = Math.min(Math.max(safeValue / safeMax, 0), 1)
  const dashArray = `${circumference} ${circumference}`
  const dashOffset = circumference * (1 - pct)

  const display =
    typeof decimals === "number" && decimals > 0
      ? safeValue.toFixed(decimals)
      : Math.round(safeValue).toString()

  const ariaText = suffix && suffix.trim().length ? `${display}${suffix}` : display
  const titleText = title ?? ariaText

  return (
    <svg
      width={size}
      height={size}
      className={className}
      style={style}
      role="progressbar"
      aria-label={titleText}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-valuetext={ariaText}
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

      {/* NUEVO: relleno central suave */}
      {centerFill ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerR}
          fill={centerFill}
        />
      ) : null}

      {/* valor central (opcional) */}
      {showValue && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          alignmentBaseline="middle"
          dominantBaseline="middle"
          fontSize={size * 0.25}
          fontWeight={700}
          fill={textColor}
          dy="0"
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
      )}

      <title>{titleText}</title>
    </svg>
  )
}