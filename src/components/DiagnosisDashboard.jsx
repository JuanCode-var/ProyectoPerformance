// client/src/components/DiagnosisDashboard.jsx
import React from 'react';

// Aquí irá la estructura HTML que traigas de EjecutarDiagnostico.html.bak.
// He limpiado las etiquetas y convertido a JSX de ejemplo:
export function DiagnosisDashboard({ data }) {
  if (!data) {
    return <p>No hay datos para mostrar todavía.</p>;
  }

  return (
    <div className="diagnosis-dashboard">
      <h2>Diagnóstico de Auditoría</h2>

      {/* Ejemplo de puntajes */}
      <div className="metrics">
        <div className="metric">
          <h3>Performance</h3>
          <p>{data.performance}</p>
        </div>
        <div className="metric">
          <h3>Accesibilidad</h3>
          <p>{data.accessibility}</p>
        </div>
        {/* ...otros bloques según tu HTML original */}
      </div>

      {/* Si tenías tablas: */}
      <table>
        <thead>
          <tr><th>Métrica</th><th>Valor</th></tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td><td>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
