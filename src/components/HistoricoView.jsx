// src/components/HistoricoView.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import CircularGauge from './CircularGauge';
import '../styles/diagnostico.css';
import '../styles/historico.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

// ms → segundos (1 decimal)
const toSeconds = (ms) => {
  if (ms == null || Number.isNaN(ms)) return 0;
  return Math.round((ms / 1000) * 10) / 10;
};

// 🎨 Umbrales por métrica (segundos) + performance (0–100)
function gaugeColor(metricId, value) {
  const green = '#22c55e', amber = '#f59e0b', red = '#ef4444';
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

// map clave -> id audit en LHR
const LHR_ID_MAP = {
  fcp:  'first-contentful-paint',
  lcp:  'largest-contentful-paint',
  tbt:  'total-blocking-time',
  si:   'speed-index',
  ttfb: 'server-response-time',
};

// Lee PERFORMANCE desde varias fuentes
function readPerformance(doc) {
  if (typeof doc?.performance === 'number' && !Number.isNaN(doc.performance)) {
    return Math.round(doc.performance);
  }
  const pagespeed = doc?.audit?.pagespeed || {};
  if (typeof pagespeed.performance === 'number') {
    return Math.round(pagespeed.performance);
  }
  const score = pagespeed?.raw?.lighthouseResult?.categories?.performance?.score;
  if (typeof score === 'number') {
    return Math.round(score * 100);
  }
  return 0;
}

// Lee métrica de tiempo desde múltiples fuentes (devuelve ms)
function readTimeMetricMs(doc, key) {
  const pagespeed = doc?.audit?.pagespeed || {};
  const unl = doc?.audit?.unlighthouse || {};

  // 1) doc.metrics
  if (doc?.metrics && typeof doc.metrics[key] === 'number') return doc.metrics[key];

  // 2) api.metrics (pagespeed o unlighthouse)
  if (pagespeed?.metrics && typeof pagespeed.metrics[key] === 'number') return pagespeed.metrics[key];
  if (unl?.metrics && typeof unl.metrics[key] === 'number') return unl.metrics[key];

  // 3) api con la métrica suelta
  if (typeof pagespeed[key] === 'number') return pagespeed[key];
  if (typeof unl[key] === 'number') return unl[key];

  // 4) raw LHR
  const lhr = pagespeed?.raw?.lighthouseResult;
  const id = LHR_ID_MAP[key];
  const nv = lhr?.audits?.[id]?.numericValue;
  if (typeof nv === 'number') return nv;

  return 0;
}

export default function HistoricoView() {
  const query      = useQuery();
  const url        = query.get('url') || '';
  const navigate   = useNavigate();
  const [history, setHistory] = useState(null);
  const [err, setErr]         = useState('');
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState('');
  const metricKeys = ['performance','fcp','lcp','tbt','si','ttfb'];
  const [currentIndex, setCurrentIndex] = useState([]);

  if (!url) return <Navigate to="/" replace />;

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/audit/history?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        setHistory(data);
        setCurrentIndex(Array(metricKeys.length).fill(0));
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [url]);

  if (err) return (
    <div className="card">
      <p className="error">Error: {err}</p>
      <Link to="/" className="back-link">← Volver</Link>
    </div>
  );
  if (!history) return (
    <div className="card loading-placeholder">
      <div className="spinner"/>
      <p>Cargando histórico…</p>
    </div>
  );
  if (history.length === 0) return (
    <div className="card">
      <Link to="/" className="back-link">← Volver</Link>
      <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>
      <p>No hay registros anteriores para esta URL.</p>
    </div>
  );

  const handlePrev = (row) => {
    setCurrentIndex(idxs => {
      const copy = [...idxs];
      copy[row] = Math.max(0, copy[row] - 1);
      return copy;
    });
  };
  const handleNext = (row) => {
    setCurrentIndex(idxs => {
      const copy = [...idxs];
      copy[row] = Math.min(history.length - 1, copy[row] + 1);
      return copy;
    });
  };

  return (
    <div className="card">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/" className="back-link"> Nuevo diagnóstico</Link>
        <button
          onClick={() => navigate(-1)}
          className="back-link"
          style={{ marginLeft: '1rem' }}
        >
          Volver al diagnóstico
        </button>
      </div>

      <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>
      <div className="metrics-title">Comparación de métricas</div>

      <div className="gauges-grid">
        {metricKeys.map((key, row) => {
          const idx         = currentIndex[row] || 0;
          const item        = history[idx];
          const dateObj     = new Date(item.fecha);
          const displayDate = dateObj.toLocaleDateString();
          const displayTime = dateObj.toLocaleTimeString();

          let val, suffix, decimals;
          if (key === 'performance') {
            val = readPerformance(item);   // 0–100
            suffix = '%';
            decimals = 0;
          } else {
            const ms = readTimeMetricMs(item, key);
            val = toSeconds(ms);           // segundos con 1 decimal
            suffix = 's';
            decimals = 1;
          }

          return (
            <motion.div
              key={key}
              className="gauge-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: row * 0.1 }}
            >
              <h3 className="item-label">{key.toUpperCase()}</h3>

              <div className="historico-carousel">
                <button
                  className="carousel-btn"
                  onClick={() => handlePrev(row)}
                  disabled={idx === 0}
                >
                  <ArrowLeft size={20}/>
                </button>

                <div className="carousel-gauge">
                  <CircularGauge
                    value={val}
                    max={key === 'performance' ? 100 : undefined}
                    color={gaugeColor(key, val)}
                    decimals={decimals}
                    suffix={suffix}
                  />
                  <div className="date">
                    {displayDate}<br />{displayTime}
                  </div>
                </div>

                <button
                  className="carousel-btn"
                  onClick={() => handleNext(row)}
                  disabled={idx === history.length - 1}
                >
                  <ArrowRight size={20}/>
                </button>
              </div>

              <div className="carousel-indicator">
                {idx + 1} / {history.length}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Envío de informe por correo */}
      <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
        <button
          className="btn-primary"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            setSentMsg('');
            try {
              const resp = await fetch('/api/audit/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url,
                  email: history[history.length - 1]?.email // usa el último email registrado
                })
              });
              const text = await resp.text();
              let payload;
              try { payload = JSON.parse(text); } catch { payload = { error: text || `Error ${resp.status}` }; }
              if (!resp.ok) throw new Error(payload.error || payload.message || `Error ${resp.status}`);
              setSentMsg(`✅ ${payload.message}`);
            } catch (e) {
              setSentMsg(`❌ ${e.message}`);
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? 'Enviando…' : 'Enviar informe por correo ✉️'}
        </button>

        {sentMsg && (
          <p style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: sentMsg.startsWith('❌') ? '#dc2626' : '#047857'
          }}>
            {sentMsg}
          </p>
        )}
      </div>
    </div>
  );
}
