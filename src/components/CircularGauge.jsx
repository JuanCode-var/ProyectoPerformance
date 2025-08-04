import React from 'react';

export default function CircularGauge({ value = 0, max = 100, color = '#4ade80', size = 120, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // porcentaje de “relleno”
  const pct = Math.min(Math.max(value / max, 0), 1);
  const dash = pct * circumference;

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
        {Math.round(value)}
      </text>
    </svg>
  );
}

