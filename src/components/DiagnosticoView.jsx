import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import CircularGauge from './CircularGauge';
import ActionPlanPanel from '../components/ActionPlanPanel';
import EmailSendBar from "../components/EmailPdfBar";
import '../styles/diagnostico.css';

const API_LABELS = { pagespeed: 'Lighthouse', unlighthouse: 'Unlighthouse' };

// ---------------- Utils ----------------
async function safeParseJSON(res) {
  const text = await res.text();
  try { return JSON.parse(text || '{}'); }
  catch { return { _raw: text }; }
}

const toSeconds = (ms) =>
  (typeof ms === 'number' && !Number.isNaN(ms))
    ? Math.round((ms / 1000) * 10) / 10
    : null;

function gaugeColor(metricId, value) {
  const green = '#22c55e', amber = '#f59e0b', red = '#ef4444', gray = '#9ca3af';
  if (value == null) return gray;
  if (metricId === 'performance') return value >= 90 ? green : value >= 50 ? amber : red;
  switch (metricId) {
    case 'fcp':  return value < 1.8 ? green : value <= 3.0 ? amber : red;
    case 'lcp':  return value < 2.5 ? green : value <= 4.0 ? amber : red;
    case 'tbt':  return value < 0.2 ? green : value <= 0.6 ? amber : red;
    case 'si':   return value < 3.4 ? green : value <= 5.8 ? amber : red;
    case 'ttfb': return value < 0.8 ? green : value <= 1.8 ? amber : red;
    default:     return amber;
  }
}
const trendSymbol = (t) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
const trendColor  = (t) => t === 'up' ? '#16a34a' : t === 'down' ? '#ef4444' : '#6b7280';

// ✅ Busca audits en cualquier forma (PSI remoto y Lighthouse local)
function pickAudits(apiData) {
  return (
    apiData?.raw?.lighthouseResult?.audits || // PSI
    apiData?.raw?.audits ||                   // 👈 LOCAL (LHR puro)
    apiData?.lighthouseResult?.audits ||
    apiData?.result?.lhr?.audits ||
    apiData?.result?.lighthouseResult?.audits ||
    apiData?.data?.lhr?.audits ||
    apiData?.data?.lighthouseResult?.audits ||
    apiData?.audits ||
    {}
  );
}

// ---------------- Builders ----------------
function buildFindings(apiData, processed) {
  const fromProcessed = {
    errors: Array.isArray(processed?.errors) ? processed.errors : [],
    improvements: Array.isArray(processed?.improvements) ? processed.improvements : [],
  };
  if (fromProcessed.errors.length || fromProcessed.improvements.length) return fromProcessed;

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...a }));

  const errors = [];
  const improvements = [];

  for (const a of all) {
    if (a?.scoreDisplayMode === 'manual' || a?.scoreDisplayMode === 'notApplicable') continue;

    const item = {
      id: a.id,
      title: a.title || a.id,
      description: a.description || '',
      displayValue: a.displayValue || '',
      details: a.details || null,
      score: typeof a.score === 'number' ? a.score : null,
      typeHint: a?.details?.type || null, // 'opportunity' | 'diagnostic'
    };

    if (typeof item.score === 'number') {
      if (item.score < 0.5) errors.push(item);
      else if (item.score < 1) improvements.push(item);
    } else if (item.typeHint === 'opportunity') {
      improvements.push(item);
    }
  }

  errors.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  improvements.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return { errors, improvements };
}

function buildOpportunities(apiData, processed) {
  if (Array.isArray(processed?.opportunities) && processed.opportunities.length) {
    return processed.opportunities.map((o) => ({
      type: 'improvement', severity: 'info', impactScore: 100, ...o
    }));
  }

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...a }));
  const opps = [];

  for (const a of all) {
    const d = a.details || {};
    const hasOppType = d.type === 'opportunity';
    const savingsMs = (typeof d.overallSavingsMs === 'number') ? d.overallSavingsMs : null;
    const savingsB  = (typeof d.overallSavingsBytes === 'number') ? d.overallSavingsBytes : null;

    if (hasOppType || savingsMs != null || savingsB != null) {
      let savingsLabel = '';
      if (savingsMs != null && savingsMs > 0) {
        savingsLabel = (savingsMs >= 100)
          ? `${Math.round((savingsMs/1000)*10)/10}s`
          : `${Math.round(savingsMs)}ms`;
      } else if (savingsB != null && savingsB > 0) {
        const kb = savingsB/1024;
        savingsLabel = (kb >= 1024) ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
      } else if (a.displayValue) {
        savingsLabel = a.displayValue;
      }

      opps.push({
        id: a.id,
        title: a.title || a.id,
        recommendation: a.description || '',
        savingsLabel,
        impactScore: (savingsMs || 0) + (savingsB ? Math.min(savingsB/10, 1000) : 0),
        type: 'improvement',
        severity: 'info',
      });
    }
  }
  opps.sort((b, a) => (a.impactScore || 0) - (b.impactScore || 0));
  return opps;
}

//Convierte en español
const ES = new Map([
  // títulos
  ['Avoid multiple page redirects', 'Evitar múltiples redirecciones de página'],
  ['Reduce unused JavaScript', 'Reducir JavaScript no utilizado'],
  ['Initial server response time was short', 'Tiempo de respuesta inicial del servidor'],
  // descripciones cortas (puedes ampliar a tu gusto):
  ['Reduce unused rules from stylesheets', 'Reducir reglas CSS no utilizadas'],
]);

const t = (s) => (typeof s === 'string' && ES.get(s)) || s;


// ---------------- Component ----------------
export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id = params?.id || new URLSearchParams(location.search).get('id');

  const [auditData, setAuditData] = useState(null);
  const [err, setErr] = useState('');
  const [activeApi, setActiveApi] = useState('');
  const [processed, setProcessed] = useState(null);

  const contenedorReporteRef = useRef(null);

  useEffect(() => {
    setAuditData(null); setErr(''); setActiveApi(''); setProcessed(null);
    if (!id) return;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(id).trim());
    if (!isValidObjectId) { setErr('ID inválido'); return; }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${id}`);
        const payload = await safeParseJSON(res);
        if (!res.ok) {
          const msg = payload.error || payload.message || payload._raw || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const available = Object.keys(payload.audit || {}).filter(k => {
          const m = (payload.audit[k] || {}).metrics || payload.audit[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ['pagespeed','unlighthouse'];
        const apis = ORDER.filter(k => available.includes(k));

        if (mounted) {
          setActiveApi(apis[0] || '');
          setAuditData(payload);

          // procesado puede fallar (404). Si falla, el fallback a LHR se encarga.
          if (payload.url) {
            fetch(`/api/diagnostics/${encodeURIComponent(payload.url)}/processed`)
              .then(async (r) => {
                const data = await safeParseJSON(r);
                if (!r.ok) throw new Error(data.error || data.message || data._raw || `HTTP ${r.status}`);
                return data;
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

  const tbtApiS   = toSeconds(metrics.tbt);
  const tbtProcMs = processed?.metrics?.find(m => m.key === 'tbt')?.raw;
  const tbtSec = (tbtApiS != null) ? tbtApiS : (typeof tbtProcMs === 'number' ? Math.round((tbtProcMs/1000)*10)/10 : null);

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
  const { errors: detectedErrors, improvements } = buildFindings(apiData, processed);
  const opportunities = buildOpportunities(apiData, processed);

  // Normalización para ActionPlanPanel
  const mapFindingToOpp = (arr, kind) => arr.map((e, i) => {
    let savingsLabel = e.displayValue || '';
    const ms = e?.details?.overallSavingsMs;
    const bytes = e?.details?.overallSavingsBytes;
    if (!savingsLabel && typeof ms === 'number') {
      savingsLabel = ms >= 100 ? `${Math.round((ms/1000)*10)/10}s` : `${Math.round(ms)}ms`;
    } else if (!savingsLabel && typeof bytes === 'number') {
      const kb = bytes / 1024;
      savingsLabel = kb >= 1024 ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
    }
    return {
      id: e.id || `finding-${kind}-${i}`,
      title: e.title || e.id || 'Hallazgo',
      recommendation: e.description || e.displayValue || '',
      savingsLabel,
      type: kind,                                  // 'error' | 'improvement'
      severity: kind === 'error' ? 'critical' : 'info',
      impactScore: kind === 'error' ? 2000 : (typeof e.impactScore === 'number' ? e.impactScore : 100),
    };
  });

  const planItems = [
    ...opportunities.map(o => ({
      type: 'improvement', severity: 'info', impactScore: 100, ...o
    })),
    ...mapFindingToOpp(detectedErrors, 'error'),
    ...mapFindingToOpp(improvements, 'improvement'),
  ];

  return (
    <div className="card">
      <div ref={contenedorReporteRef}>
        <Link to="/" className="back-link"> Nuevo diagnóstico</Link>
        <Link to={`/historico?url=${encodeURIComponent(url)}`} className="back-link" style={{ marginLeft: '1rem' }}>Ver histórico de esta URL</Link>

        <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
        <div className="date">{new Date(fecha).toLocaleString()}</div>

        {/* {(source === 'local' || auditData?.isLocal) && (
          <div role="alert" aria-live="polite" style={{
            marginTop:12, marginBottom:8, padding:'10px 12px', borderRadius:10,
            border:'1px solid #f59e0b55', background:'#fffbeb', color:'#92400e',
            fontSize:'0.9rem', boxShadow:'0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <strong style={{ textDecoration: 'underline' }}>Resultado con Lighthouse local</strong>.
            Google PSI alcanzó su cuota o no estuvo disponible. Este resultado puede diferir del de PSI.
          </div>
        )} */}

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

        <ActionPlanPanel
          opportunities={planItems}
          performance={performance ?? undefined}
        />
      </div>

      <EmailSendBar
        captureRef={contenedorReporteRef}
        url={url}
        email={auditData?.email || ""}
        hideEmailInput={true}
        subject={`Diagnóstico de ${url}`}
        endpoint="/api/audit/send-diagnostic"
        includePdf={true}
      />
    </div>
  );
}