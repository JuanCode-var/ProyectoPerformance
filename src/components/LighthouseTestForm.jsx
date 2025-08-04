import React, { useState } from 'react';
import { runAudit } from '../services/audit.service';
import CircularGauge from './CircularGauge';
import SemaforoBadge from './SemaforoBadge';
import { perfColor, metricColor } from '../utils/lighthouseColors';

export default function LighthouseTestForm() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await runAudit({ url, type: 'pagespeed', strategy: 'mobile' });
      setDoc(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const result = doc?.audit?.pagespeed;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <form onSubmit={onSubmit} className="flex gap-3 items-center">
        <input
          type="url"
          className="flex-1 border rounded p-2"
          placeholder="https://ejemplo.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? 'Auditando...' : 'Auditar'}
        </button>
      </form>

      {error && <p className="text-red-600 mt-4">{error}</p>}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Diagnóstico de Rendimiento</h2>
          <SemaforoBadge score={result.performance} />
          </div>

          <div className="flex gap-8 items-center">
            <div>
              <CircularGauge
                value={result.performance}
                max={100}
                color={perfColor(result.performance)}
              />
              <div className="text-center mt-2 font-semibold">Performance</div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Core Web Vitals / Métricas</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(result.metrics).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: metricColor(v, k)
                    }}></span>
                    <span className="uppercase font-medium">{k}</span>:
                    <span>{v == null ? '—' : v}</span>
                    {['fcp','lcp','tbt','si','ttfb'].includes(k) && v != null && <span>ms</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <details className="bg-gray-100 p-3 rounded">
            <summary className="cursor-pointer">Ver JSON completo</summary>
            <pre className="text-xs overflow-auto mt-2">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
