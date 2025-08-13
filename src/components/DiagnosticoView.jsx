import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import CircularGauge from './CircularGauge';
import ActionPlanPanel from './ActionPlanPanel';
import '../styles/diagnostico.css';

const API_LABELS = { pagespeed: 'Lighthouse', unlighthouse: 'Unlighthouse' };

// ms → segundos (1 decimal)
const toSeconds = (ms) =>
  (typeof ms === 'number' && !Number.isNaN(ms))
    ? Math.round((ms / 1000) * 10) / 10
    : null;

// 🎨 Umbrales por métrica (segundos)
function gaugeColor(metricId, value) {
  const green = '#22c55e', amber = '#f59e0b', red = '#ef4444', gray = '#9ca3af';
  if (value == null) return gray;
  if (metricId === 'performance') {
    if (value >= 90) return green;
    if (value >= 50) return amber;
    return red;
  }
  switch (metricId) {
    case 'fcp':  return (value < 1.8) ? green : (value <= 3.0 ? amber : red);
    case 'lcp':  return (value < 2.5) ? green : (value <= 4.0 ? amber : red);
    case 'tbt':  return (value < 0.2) ? green : (value <= 0.6 ? amber : red);
    case 'si':   return (value < 3.4) ? green : (value <= 5.8 ? amber : red);
    case 'ttfb': return (value < 0.8) ? green : (value <= 1.8 ? amber : red);
    default:     return amber;
  }
}
const trendSymbol = (t) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
const trendColor  = (t) => t === 'up' ? '#16a34a' : t === 'down' ? '#ef4444' : '#6b7280';

export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id = params?.id || new URLSearchParams(location.search).get('id'); // guard: evita /api/audit/undefined

  const [auditData, setAuditData] = useState(null);
  const [err, setErr] = useState('');
  const [activeApi, setActiveApi] = useState('');
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    setAuditData(null); setErr(''); setActiveApi(''); setProcessed(null);
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${id}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || `Error ${res.status}`);

        // Selección de API preferida
        const available = Object.keys(payload.audit || {}).filter(k => {
          const m = (payload.audit[k] || {}).metrics || payload.audit[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ['pagespeed','unlighthouse'];
        const apis = ORDER.filter(k => available.includes(k));

        if (mounted) {
          setActiveApi(apis[0] || '');
          setAuditData(payload);

          if (payload.url) {
            fetch(`/api/diagnostics/${encodeURIComponent(payload.url)}/processed`)
              .then(async (r) => {
                const text = await r.text();
                if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
                if (!text) throw new Error('Empty response');
                return JSON.parse(text);
              })
              .then((d) => { if (mounted) setProcessed(d); })
              .catch(() => {});
          }
        }
      } catch (e) { if (mounted) setErr(e.message); }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (!id) {
    return (
      <div className="card">
        <p className="error">Falta el ID del diagnóstico.</p>
        <Link to="/" className="back-link">← Volver</Link>
      </div>
    );
  }

  if (err) return (
    <div className="card">
      <p className="error">Error: {err}</p>
      <Link to="/" className="back-link">← Volver</Link>
    </div>
  );

  if (!auditData) return (
    <div className="card loading-placeholder">
      <div className="spinner" />
      <p>Cargando diagnóstico…</p>
    </div>
  );

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

  // Métricas y fallback
  let performance = null;
  if (typeof apiData.performance === 'number') performance = Math.round(apiData.performance);
  else if (typeof metrics.performance === 'number') performance = Math.round(metrics.performance);
  else if (processed?.metrics) {
    const p = processed.metrics.find(m => m.key === 'performance')?.raw;
    if (typeof p === 'number') performance = Math.round(p);
  }

  const fcpSec  = toSeconds(metrics.fcp)  ?? processed?.metrics?.find(m => m.key === 'fcp')?.raw ?? null;
  const lcpSec  = toSeconds(metrics.lcp)  ?? processed?.metrics?.find(m => m.key === 'lcp')?.raw ?? null;
  const siSec   = toSeconds(metrics.si)   ?? processed?.metrics?.find(m => m.key === 'si')?.raw  ?? null;
  const ttfbSec = toSeconds(metrics.ttfb) ?? processed?.metrics?.find(m => m.key === 'ttfb')?.raw?? null;

  // TBT: en PSI viene en ms; en processed suele venir ms también
  const tbtApiS   = toSeconds(metrics.tbt);
  const tbtProcMs = processed?.metrics?.find(m => m.key === 'tbt')?.raw;
  const tbtSec = (tbtApiS != null)
    ? tbtApiS
    : (typeof tbtProcMs === 'number' ? Math.round((tbtProcMs/1000)*10)/10 : null);

  const trendByKey = {};
  if (processed?.metrics) for (const m of processed.metrics) trendByKey[m.key] = m.trend;

  const items = [
    { id: 'performance', label: 'PERFORMANCE', value: performance, desc: `Porcentaje de rendimiento según ${API_LABELS[activeApi]}.` },
    { id: 'fcp', label: 'FCP', value: fcpSec, desc: 'Tiempo hasta la primera pintura de contenido (s)' },
    { id: 'lcp', label: 'LCP', value: lcpSec, desc: 'Tiempo hasta la pintura de contenido más grande (s)' },
    { id: 'tbt', label: 'TBT', value: tbtSec, desc: 'Tiempo total de bloqueo (s)' },
    { id: 'si',  label: 'SI',  value: siSec,  desc: 'Índice de velocidad (s)' },
    { id: 'ttfb',label: 'TTFB',value: ttfbSec,desc: 'Tiempo hasta el primer byte (s)' },
  ];

  const source = apiData?.meta?.source;

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
        {items.map(item => (
          <div key={item.id} className="item">
            <h3 className="item-label" style={{display:'flex',alignItems:'center',gap:8}}>
              {item.label}
              {processed && trendByKey[item.id] && (
                <span style={{fontSize:12, color: trendColor(trendByKey[item.id])}}>
                  {trendSymbol(trendByKey[item.id])}
                </span>
              )}
            </h3>
            <CircularGauge
              value={item.value ?? 0}
              max={item.id === 'performance' ? 100 : undefined}
              color={gaugeColor(item.id, item.value)}
              decimals={item.id === 'performance' ? 0 : 1}
              suffix={item.id === 'performance' ? '%' : 's'}
            />
            <p className="item-desc">
              {item.value == null ? 'N/A' : (item.id === 'performance' ? `${item.value}%` : `${item.value.toFixed(1)}s`)} — {item.desc}
            </p>
          </div>
        ))}
      </div>

      {processed && (
        <ActionPlanPanel
          opportunities={processed.opportunities || []}
          performance={performance ?? undefined}
        />
      )}
    </div>
  );
}
