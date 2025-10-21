// src/hooks/useAudits.ts
import { useState, useEffect } from 'react';
import { fetchAudit } from '../services/audit.service';

type AuditPayload = {
  status: 'pending' | 'done' | string;
  audit?: {
    pagespeed?: any;
    [k: string]: any;
  };
};

export function useAudit(id: string) {
  const [auditData, setAuditData] = useState<any>(null);
  const [status, setStatus] = useState<AuditPayload['status']>('pending');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    let handle: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const payload = (await fetchAudit(id)) as AuditPayload;
        if (!mounted) return;

        setStatus(payload.status);

        if (payload.status === 'done') {
          setAuditData(payload.audit?.pagespeed ?? null);
          if (handle) clearInterval(handle);
        }
      } catch (e: any) {
        if (!mounted) return;
        if (handle) clearInterval(handle);
        setError(e?.message || 'Error desconocido');
      }
    }

    // Primera llamada + polling cada 2s
    load();
    handle = setInterval(load, 2000);

    return () => {
      mounted = false;
      if (handle) clearInterval(handle);
    };
  }, [id]);

  return { auditData, status, error };
}
