// src/components/HistoricoView.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, Link, Navigate, useNavigate } from 'react-router-dom';  // 🔄 import useNavigate
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';             // 🔄 import ChevronLeft
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
  const navigate   = useNavigate();                                               // 🔄 initialize navigate
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

        {/* 🔄 NUEVO: botón para volver al diagnóstico previo */}
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
          const apiData     = item.audit.pagespeed || item.audit.unlighthouse || {};
          const m           = apiData.metrics || apiData;
          const val         = Math.round(m[key] || 0);
          const bottomLabel = (['tbt'].includes(key) && val === 0) ? 'N/A' : val;
          
          const showValueUnder = false;

          return (
            <motion.div key={key}
                        className="gauge-card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: row * 0.1 }}>
              <h3 className="item-label">{key.toUpperCase()}</h3>

              <div className="historico-carousel">
                <button className="carousel-btn"
                        onClick={() => handlePrev(row)}
                        disabled={idx === 0}>
                  <ArrowLeft size={20}/>
                </button>

               <div className="carousel-gauge">
                <CircularGauge
                  value={val}
                  max={key === 'performance' ? 100 : undefined}
                  color={perfColor(val)}
                />

                {key !== 'performance' && showValueUnder && (
                  <div className="item-value">{bottomLabel}</div>
                )}

                <div className="date">
                  {displayDate}<br />{displayTime}
                </div>
              </div>

                <button className="carousel-btn"
                        onClick={() => handleNext(row)}
                        disabled={idx === history.length - 1}>
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
                body: JSON.stringify({ url, email: history[history.length - 1]?.email })
              });

              const text = await resp.text();
              let payload;
              try {
                payload = JSON.parse(text);
              } catch {
                payload = { error: text || `Error ${resp.status}` };
              }

              if (!resp.ok) {
                throw new Error(payload.error || payload.message || `Error ${resp.status}`);
              }

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
