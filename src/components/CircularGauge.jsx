import React from 'react';

export default function CircularGauge({
  value = 0,
  max = 100,
  color = '#4ade80',
  size = 120,
  strokeWidth = 12,
  // nuevos props:
  decimals = 0,     // cuántos decimales mostrar
  suffix = ''       // texto a la derecha del número (p. ej. "s" o "%")
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // protege división por 0/NaN:
  const safeMax = typeof max === 'number' && max > 0 ? max : 100;
  const pct = Math.min(Math.max(value / safeMax, 0), 1);
  const dash = pct * circumference;

  // render del valor
  const display =
    typeof value === 'number' && !Number.isNaN(value)
      ? (decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString())
      : '0';

  return (
    <svg width={size} height={size}>
      <circle
        cx={size/2}
        cy={size/2}
        r={radius}
        fill="transparent"
        stroke="#ddd"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size/2}
        cy={size/2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.25}
        fontWeight="700"
        fill="#111"
      >
        {display}{suffix}
      </text>
    </svg>
  );
}
