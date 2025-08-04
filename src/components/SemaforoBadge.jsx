import React from 'react';

export default function SemaforoBadge({ score = 0, style }) {
  // Definimos colores según score
  let background = '#dc2626'; // rojo
  if (score >= 90) background = '#16a34a'; // verde
  else if (score >= 50) background = '#d97706'; // amarillo

  return (
    <span
      className="semaforo-badge"
      style={{
        background,
        ...style
      }}
    >
      {score <= 49 ? 'LENTO' : score <= 89 ? 'MEDIO' : 'RÁPIDO'}
    </span>
  );
}


