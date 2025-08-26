// src/components/HistoricoView.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import CircularGauge from './CircularGauge';
import { z } from 'zod';

// shadcn/ui (padres)
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';

function useQuery(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

// ms → segundos (1 decimal)
const toSeconds = (ms: number | null | undefined): number => {
  if (ms == null || Number.isNaN(ms as number)) return 0;
  return Math.round((Number(ms) / 1000) * 10) / 10;
};

// 🎨 Umbrales por métrica (segundos) + performance (0–100)
type MetricKey = 'performance' | 'fcp' | 'lcp' | 'tbt' | 'si' | 'ttfb';
function gaugeColor(metricId: MetricKey, value: number): string {
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
const LHR_ID_MAP: Record<Exclude<MetricKey, 'performance'>, string> = {
  fcp:  'first-contentful-paint',
  lcp:  'largest-contentful-paint',
  tbt:  'total-blocking-time',
  si:   'speed-index',
  ttfb: 'server-response-time',
};

// Lee PERFORMANCE desde varias fuentes
type AuditDoc = any; // flexible para compatibilidad
function readPerformance(doc: AuditDoc): number {
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
function readTimeMetricMs(doc: AuditDoc, key: Exclude<MetricKey, 'performance'>): number {
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

// ---------- Zod (validación suave de query y payload) ----------
const QuerySchema = z.object({ url: z.string().url().optional() });

const HistoryItemSchema = z.object({
  fecha: z.string().optional(),
  email: z.string().email().optional(),
  performance: z.number().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  audit: z
    .object({
      pagespeed: z.any().optional(),
      unlighthouse: z.any().optional(),
    })
    .optional(),
}).passthrough();

const HistoryArraySchema = z.array(HistoryItemSchema);

// 🔒 Parseo seguro con Zod: nunca lanza
async function safeParse(res: Response): Promise<any[]> {
  const txt = await res.text();
  let raw: any[];
  try { raw = JSON.parse(txt || '[]'); } catch { raw = []; }
  const parsed = HistoryArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : raw;
}

export default function HistoricoView() {
  const query      = useQuery();
  const url        = query.get('url') || '';
  const navigate   = useNavigate();
  const [history, setHistory] = useState<any[] | null>(null);
  const [err, setErr]         = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sentMsg, setSentMsg] = useState<string>('');
  const metricKeys: MetricKey[] = ['performance','fcp','lcp','tbt','si','ttfb'];
  const [currentIndex, setCurrentIndex] = useState<number[]>([]);

  // Si el URL está vacío o es inválido → volver
  const urlIsValid = QuerySchema.safeParse({ url }).success;
  if (!url || !urlIsValid) return <Navigate to="/" replace />;

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/audit/history?url=${encodeURIComponent(url)}`);
        const data = await safeParse(res); // ← blindado + Zod
        if (!res.ok) throw new Error((data as any)?.error || `Error ${res.status}`);
        setHistory(Array.isArray(data) ? (data as any[]) : []);
        setCurrentIndex(Array(metricKeys.length).fill(0));
      } catch (e: any) {
        setErr(e?.message || 'Error cargando histórico');
      }
    })();
  }, [url]);

  // ---- Estados tempranos con Card (padre shadcn) ----
  if (err) return (
    <Card>
      <CardContent className="p-6">
        <p className="error">Error: {err}</p>
        <Link to="/" className="back-link">← Volver</Link>
      </CardContent>
    </Card>
  );
  if (!history) return (
    <Card>
      <CardContent className="p-6">
        <div className="spinner"/>
        <p>Cargando histórico…</p>
      </CardContent>
    </Card>
  );
  if (history.length === 0) return (
    <Card>
      <CardContent className="p-6">
        <Link to="/" className="back-link">← Volver</Link>
        <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>
        <p>No hay registros anteriores para esta URL.</p>
      </CardContent>
    </Card>
  );

  const handlePrev = (row: number) => {
    setCurrentIndex(idxs => {
      const copy = [...idxs];
      copy[row] = Math.max(0, (copy[row] ?? 0) - 1);
      return copy;
    });
  };
  const handleNext = (row: number) => {
    setCurrentIndex(idxs => {
      const copy = [...idxs];
      copy[row] = Math.min(history.length - 1, (copy[row] ?? 0) + 1);
      return copy;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>

      <CardContent>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/" className="back-link"> Nuevo diagnóstico</Link>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="back-link ml-4"
          >
            Volver al diagnóstico
          </Button>
        </div>

        <h2 className="diagnostico-title">Histórico de <span className="url">{url}</span></h2>
        <div className="metrics-title">Comparación de métricas</div>

        <div className="gauges-grid">
          {metricKeys.map((key, row) => {
            const idx         = currentIndex[row] || 0;
            const item: any   = history[idx];
            const dateObj     = new Date(item.fecha);
            const displayDate = dateObj.toLocaleDateString();
            const displayTime = dateObj.toLocaleTimeString();

            let val: number, suffix: string, decimals: number;
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
                  <Button
                    variant="outline"
                    className="carousel-btn"
                    onClick={() => handlePrev(row)}
                    disabled={idx === 0}
                  >
                    <ArrowLeft size={20}/>
                  </Button>

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

                  <Button
                    variant="outline"
                    className="carousel-btn"
                    onClick={() => handleNext(row)}
                    disabled={idx === history.length - 1}
                  >
                    <ArrowRight size={20}/>
                  </Button>
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
          <Button
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
                    email: (history[history.length - 1] as any)?.email || "" // último email registrado
                  })
                });
                const text = await resp.text();
                let payload: any;
                try { payload = JSON.parse(text); } catch { payload = { error: text || `Error ${resp.status}` }; }
                if (!resp.ok) throw new Error(payload.error || payload.message || `Error ${resp.status}`);
                setSentMsg(`✅ ${payload.message}`);
              } catch (e: any) {
                setSentMsg(`❌ ${e.message}`);
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? 'Enviando…' : 'Enviar informe por correo ✉️'}
          </Button>

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
      </CardContent>
    </Card>
  );
}