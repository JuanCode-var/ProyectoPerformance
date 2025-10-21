// src/pages/admin/telemetry/useTelemetrySummary.ts
import { useEffect, useState, useCallback } from 'react';

export interface TelemetrySummaryResponse {
  range: { from: string; to: string; days: number };
  diagnostics: {
    total: number;
    avgTotalMs: number | null;
    micros: Array<{ micro: string; avgMs: number; count: number; failCount: number }>;
    // microCallsTotal eliminado (ya no usamos la tarjeta "Micro-calls")
    // Ahora byRole contiene desglose por API (performance / security)
    byRole: Array<{
      role: string;
      total: number;
      byApi?: {
        performance?: number;
        security?: number;
      };
    }>;
    byUser: Array<{ userId: string; count: number; name?: string; role?: string }>;
    byUrl: Array<{ urlHash: string; count: number; url: string | null }>;
    pdf: { sent: number; withPdf: number; avgPdfSizeKb: number | null };
    errors: {
      byCategory: Array<{ errorCategory: string; count: number }>;
      topMicroFailures: Array<{ micro: string; count: number }>;
    };
    detail?: {
      users?: Array<{ userId: string; total: number; name?: string }>;
      urls?: Array<{ urlHash: string; total: number; url: string | null }>;
    };
    visitsByRole?: Array<{ role: string; visits: number }>;
    recent?: Array<{ ts: string; userId: string | null; name: string | null; role: string | null; url: string | null; durationMs: number | null }>;
    missingUrlCount?: number;
  };
  emails: {
    totalSent: number;
    byType: Array<{ emailType: string; count: number }>;
    failures: number;
  };
  logs: { levels: Array<{ level: string; count: number }> };
}

export function useTelemetrySummary(days = 7) {
  const [data, setData] = useState<TelemetrySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const load = useCallback(async (d: number = days) => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/telemetry/summary?days=${encodeURIComponent(d)}`, { credentials: 'include' });
      const txt = await r.text();
      const json = (()=>{ try { return JSON.parse(txt); } catch { return null; } })();
      if(!r.ok) throw new Error(json?.error || `Error ${r.status}`);
      setData(json);
    } catch(e:any) {
      setError(e?.message || 'Error cargando resumen');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(()=>{ load(days); }, [load, days]);

  return { data, loading, error, reload: load };
}