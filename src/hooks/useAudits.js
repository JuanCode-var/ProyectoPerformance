import { useState, useEffect } from 'react';
import { fetchAudit } from '../services/audit.service.js';

export function useAudit(id) {
  const [auditData, setAuditData] = useState(null);
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    let handle;              // <-- sin anotación de tipo

    async function load() {
      try {
        const payload = await fetchAudit(id);
        if (!mounted) return;
        setStatus(payload.status);
        if (payload.status === 'done') {
          setAuditData(payload.audit.pagespeed);
          clearInterval(handle);
        }
      } catch (e) {
        if (!mounted) return;
        clearInterval(handle);
        setError(e.message || 'Error desconocido');
      }
    }

    // Primera llamada + polling cada 2s
    load();
    handle = setInterval(load, 2000);

    return () => {
      mounted = false;
      clearInterval(handle);
    };
  }, [id]);

  return { auditData, status, error };
}
