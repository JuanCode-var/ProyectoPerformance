import React, { useState, useEffect } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CircularGauge from './CircularGauge';
import { perfColor } from '../utils/lighthouseColors';
import '../styles/diagnostico.css';
import '../styles/historico.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function HistoricoView() {
  const query      = useQuery();
  const url        = query.get('url') || '';
  const [history, setHistory] = useState(null);
  const [err, setErr]         = useState('');

  if (!url) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/audit/history?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        setHistory(data);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [url]);

  if (err) {
    return (
      <div className="card">
        <p className="error">Error: {err}</p>
        <Link to="/" className="back-link">← Volver</Link>
      </div>
    );
  }
  if (!history) {
    return (
      <div className="card loading-placeholder">
        <div className="spinner" />
        <p>Cargando histórico…</p>
      </div>
    );
  }
  if (history.length === 0) {
    return (
      <div className="card">
        <Link to="/" className="back-link">← Volver</Link>
        <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>
        <p>No hay registros anteriores para esta URL.</p>
      </div>
    );
  }

  const metricKeys = ['performance','fcp','lcp','cls','tbt','si','ttfb'];

  return (
    <div className="card">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
        <Link
          to={`/historico?url=${encodeURIComponent(url)}`}
          className="back-link"
          style={{ marginLeft: '1rem' }}
        >
          Ver histórico de esta URL
        </Link>
      </div>

      <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>
      <div className="metrics-title">Comparación de métricas</div>

      <div className="gauges-grid">
        {metricKeys.map((key, rowIndex) => (
          <motion.div
            key={key}
            className="gauge-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rowIndex * 0.1 }}
          >
            <h3 className="item-label">{key.toUpperCase()}</h3>
            <div className="historico-row">
              {history.map((item, idx) => {
                const dateObj     = new Date(item.fecha);
                const displayDate = dateObj.toLocaleDateString();
                const displayTime = dateObj.toLocaleTimeString();
                const apiData      = item.audit.pagespeed || item.audit.unlighthouse || {};
                const m            = apiData.metrics || apiData;
                const val          = Math.round(m[key] || 0);

                // Para CLS/TBT y val===0 mostramos "N/A"
                const bottomLabel = (['cls','tbt'].includes(key) && val === 0)
                  ? 'N/A'
                  : val;

                return (
                  <motion.div
                    key={idx}
                    className="historic-gauge"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <CircularGauge
                      value={val}
                      max={key === 'performance' ? 100 : undefined}
                      color={perfColor(val)}
                    />

                    {/* Ocultamos el valor bajo gauge solo en 'performance' */}
                    {key !== 'performance' && (
                      <div className="item-value">{bottomLabel}</div>
                    )}

                    <div className="date">
                      {displayDate}<br/>{displayTime}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
        <button className="btn-primary" disabled>
          Enviar informe por correo ✉️
        </button>
      </div>
    </div>
  );
}



