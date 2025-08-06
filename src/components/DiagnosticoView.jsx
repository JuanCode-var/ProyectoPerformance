// src/components/DiagnosticoView.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CircularGauge from './CircularGauge';
import { perfColor } from '../utils/lighthouseColors';
import '../styles/diagnostico.css';

const API_LABELS = {
  pagespeed:    'Lighthouse',
  unlighthouse: 'Unlighthouse',
};

export default function DiagnosticoView() {
  const { id } = useParams();
  const [auditData, setAuditData] = useState(null);
  const [err, setErr]             = useState('');
  const [activeApi, setActiveApi] = useState('');

  useEffect(() => {
    let mounted = true;
    setAuditData(null);
    setErr('');
    setActiveApi('');

    (async () => {
      try {
        const res     = await fetch(`/api/audit/${id}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);

        const available = Object.keys(payload.audit || {}).filter(key => {
          const apiData = payload.audit[key] || {};
          const metrics = apiData.metrics || apiData;
          return metrics && Object.keys(metrics).length > 0;
        });

        const ORDER = ['pagespeed','unlighthouse'];
        const apis   = ORDER.filter(k => available.includes(k));

        if (mounted) {
          setActiveApi(apis[0] || '');
          setAuditData(payload);
        }
      } catch (e) {
        if (mounted) setErr(e.message);
      }
    })();

    return () => { mounted = false; };
  }, [id]);

  if (err) {
    return (
      <div className="card">
        <p className="error">Error al cargar diagnóstico: {err}</p>
        <Link to="/" className="back-link">← Volver</Link>
      </div>
    );
  }

  if (!auditData) {
    return (
      <div className="card loading-placeholder">
        <div className="spinner" />
        <p>Cargando diagnóstico…</p>
      </div>
    );
  }

  const { url, fecha, audit = {} } = auditData;
  const apisDisponibles = Object.keys(audit).filter(api => {
    const apiData = audit[api] || {};
    const metrics = apiData.metrics || apiData;
    return metrics && Object.keys(metrics).length > 0;
  });

  const apiData = audit[activeApi] || {};
  const metrics = apiData.metrics || apiData;

  if (!activeApi || Object.keys(metrics).length === 0) {
    return (
      <div className="card">
        <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
        <Link
          to={`/historico?url=${encodeURIComponent(url)}`}
          className="back-link"
          style={{ marginLeft: '1rem' }}
        >
          Ver histórico de esta URL
        </Link>
        <h2 className="diagnostico-title">
          Diagnóstico de <span className="url">{url}</span>
        </h2>
        <p className="no-metrics">
          No se encontraron métricas para la API seleccionada.
        </p>
      </div>
    );
  }

  // Calcular score global
  let performance = 0;
  if (typeof apiData.performance === 'number') {
    performance = Math.round(apiData.performance);
  } else if (typeof metrics.performance === 'number') {
    performance = Math.round(metrics.performance);
  }

  const items = [
    {
      id:    'performance',
      label: 'Performance',
      value: performance,
      desc:  `Porcentaje de rendimiento según ${API_LABELS[activeApi]}.`
    },
    {
      id:    'fcp',
      label: 'FCP',
      value: Math.round(metrics.fcp  || 0),
      desc:  'Tiempo hasta la primera pintura de contenido'
    },
    {
      id:    'lcp',
      label: 'LCP',
      value: Math.round(metrics.lcp  || 0),
      desc:  'Tiempo hasta la pintura de contenido más grande'
    },
    {
      id:    'cls',
      label: 'CLS',
      value: Math.round((metrics.cls||0) * 1000),
      desc:  'Desplazamiento acumulativo de diseño'
    },
    {
      id:    'tbt',
      label: 'TBT',
      value: Math.round(metrics.tbt  || 0),
      desc:  'Tiempo total de bloqueo'
    },
    {
      id:    'si',
      label: 'SI',
      value: Math.round(metrics.si   || 0),
      desc:  'Índice de velocidad'
    },
    {
      id:    'ttfb',
      label: 'TTFB',
      value: Math.round(metrics.ttfb || 0),
      desc:  'Tiempo hasta el primer byte'
    },
  ];

  // Lista de métricas donde no mostrar el número bajo el gauge
  const hideBottomFor = ['performance','fcp','lcp','cls','tbt','si','ttfb'];
  
  return (
    <div className="card">
      <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
      <Link
        to={`/historico?url=${encodeURIComponent(url)}`}
        className="back-link"
        style={{ marginLeft: '1rem' }}
      >
        Ver histórico de esta URL
      </Link>

      <h2 className="diagnostico-title">
        Diagnóstico de <span className="url">{url}</span>
      </h2>
      <div className="date">{new Date(fecha).toLocaleString()}</div>

      <div className="tabs">
        {apisDisponibles.map(api => (
          <button
            key={api}
            onClick={() => setActiveApi(api)}
            className={`tab-button${activeApi === api ? ' active' : ''}`}
          >
            {API_LABELS[api] || api}
          </button>
        ))}
      </div>

      <div className="diagnostico-grid">
        {items.map(item => {
          const showValueUnder = !hideBottomFor.includes(item.id);
          return (
            <div key={item.id} className="item">
              <h3 className="item-label">{item.label}</h3>
              <CircularGauge
                value={item.value}
                max={item.id === 'performance' ? 100 : undefined}
                color={perfColor(item.value)}
              />
              {showValueUnder && (
                <div className="item-value">{item.value}</div>
              )}
              <p className="item-desc">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

