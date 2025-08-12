import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CircularGauge from './CircularGauge';
// import { perfColor } from '../utils/lighthouseColors'; // ⛔️ ya no lo usamos
import '../styles/diagnostico.css';

const API_LABELS = { pagespeed: 'Lighthouse', unlighthouse: 'Unlighthouse' };

// ms → segundos (1 decimal)
const toSeconds = (ms) => (ms == null || Number.isNaN(ms)) ? 0 : Math.round((ms / 1000) * 10) / 10;

// 🎨 Umbrales por métrica (segundos)
function gaugeColor(metricId, value) {
  const green = '#22c55e', amber = '#f59e0b', red = '#ef4444';
  if (metricId === 'performance') {
    if (value >= 90) return green;
    if (value >= 50) return amber;
    return red;
  }
  // tiempos en segundos
  switch (metricId) {
    case 'fcp':  return (value < 1.8) ? green : (value <= 3.0 ? amber : red);
    case 'lcp':  return (value < 2.5) ? green : (value <= 4.0 ? amber : red);
    case 'tbt':  return (value < 0.2) ? green : (value <= 0.6 ? amber : red);
    case 'si':   return (value < 3.4) ? green : (value <= 5.8 ? amber : red);
    case 'ttfb': return (value < 0.8) ? green : (value <= 1.8 ? amber : red);
    default:     return amber;
  }
}

export default function DiagnosticoView() {
  const { id } = useParams();
  const [auditData, setAuditData] = useState(null);
  const [err, setErr] = useState('');
  const [activeApi, setActiveApi] = useState('');

  useEffect(() => {
    setAuditData(null); setErr(''); setActiveApi('');
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${id}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);
        const available = Object.keys(payload.audit || {}).filter(k => {
          const m = (payload.audit[k] || {}).metrics || payload.audit[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ['pagespeed','unlighthouse'];
        const apis = ORDER.filter(k => available.includes(k));
        if (mounted) { setActiveApi(apis[0] || ''); setAuditData(payload); }
      } catch (e) { if (mounted) setErr(e.message); }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (err) return <div className="card"><p className="error">Error: {err}</p><Link to="/" className="back-link">← Volver</Link></div>;
  if (!auditData) return <div className="card loading-placeholder"><div className="spinner" /><p>Cargando diagnóstico…</p></div>;

  const { url, fecha, audit = {} } = auditData;
  const apiData = audit[activeApi] || {};
  const metrics = apiData.metrics || apiData;
  if (!activeApi || Object.keys(metrics).length === 0) {
    return (
      <div className="card">
        <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
        <Link to={`/historico?url=${encodeURIComponent(url)}`} className="back-link" style={{ marginLeft: '1rem' }}>Ver histórico de esta URL</Link>
        <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
        <p className="no-metrics">No se encontraron métricas para la API seleccionada.</p>
      </div>
    );
  }

  let performance = 0;
  if (typeof apiData.performance === 'number') performance = Math.round(apiData.performance);
  else if (typeof metrics.performance === 'number') performance = Math.round(metrics.performance);

  const fcpSec  = toSeconds(metrics.fcp);
  const lcpSec  = toSeconds(metrics.lcp);
  const tbtSec  = toSeconds(metrics.tbt);
  const siSec   = toSeconds(metrics.si);
  const ttfbSec = toSeconds(metrics.ttfb);

  const items = [
    { id: 'performance', label: 'PERFORMANCE', value: performance, desc: `Porcentaje de rendimiento según ${API_LABELS[activeApi]}.` },
    { id: 'fcp', label: 'FCP', value: fcpSec, desc: 'Tiempo hasta la primera pintura de contenido (s)' },
    { id: 'lcp', label: 'LCP', value: lcpSec, desc: 'Tiempo hasta la pintura de contenido más grande (s)' },
    { id: 'tbt', label: 'TBT', value: tbtSec, desc: 'Tiempo total de bloqueo (s)' },
    { id: 'si',  label: 'SI',  value: siSec,  desc: 'Índice de velocidad (s)' },
    { id: 'ttfb',label: 'TTFB',value: ttfbSec,desc: 'Tiempo hasta el primer byte (s)' },
  ];

  const source = apiData?.meta?.source;
  const showValueUnder = false;

  return (
    <div className="card">
      <Link to="/" className="back-link"> Nuevo diagnóstico</Link>
      <Link to={`/historico?url=${encodeURIComponent(url)}`} className="back-link" style={{ marginLeft: '1rem' }}>Ver histórico de esta URL</Link>

      <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
      <div className="date">{new Date(fecha).toLocaleString()}</div>

      {(source === 'local' || auditData?.isLocal) && (
        <div role="alert" aria-live="polite" style={{
          marginTop:12, marginBottom:8, padding:'10px 12px', borderRadius:10,
          border:'1px solid #f59e0b55', background:'#fffbeb', color:'#92400e',
          fontSize:'0.9rem', boxShadow:'0 1px 2px rgba(0,0,0,0.04)'
        }}>
          <strong style={{ textDecoration: 'underline' }}>Resultado con Lighthouse local</strong>. 
          Google PSI alcanzó su cuota o no estuvo disponible. Este resultado puede diferir del de PSI.
        </div>
      )}

      <div className="tabs">
        {Object.keys(audit).map(api => (
          <button key={api} onClick={() => setActiveApi(api)} className={`tab-button${activeApi === api ? ' active' : ''}`}>
            {API_LABELS[api] || api}
          </button>
        ))}
      </div>

      <div className="diagnostico-grid">
        {items.map(item => (
          <div key={item.id} className="item">
            <h3 className="item-label">{item.label}</h3>
            <CircularGauge
              value={item.value}
              max={item.id === 'performance' ? 100 : undefined}
              color={gaugeColor(item.id, item.value)}
              decimals={item.id === 'performance' ? 0 : 1}
              suffix={item.id === 'performance' ? '%' : 's'}
            />
            { showValueUnder && (<div className="item-value">{item.id === 'performance' ? `${item.value}%` : `${item.value}s`}</div>) }
            <p className="item-desc">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
