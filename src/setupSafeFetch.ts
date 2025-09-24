// src/setupSafeFetch.ts
// Parche defensivo: si un Response no trae cuerpo JSON válido,
// .json() devolverá {} en vez de lanzar "Unexpected end of JSON input".
// Mantiene el contrato asincrónico y no rompe llamadas existentes.

declare global {
  interface Response {
    /** Marcador interno para evitar parchear dos veces */
    __json_patched__?: true;
  }
  interface Window {
    /** Marca global para suprimir logouts automáticos hasta este timestamp (ms epoch) */
    __suppressLogoutUntil?: number;
  }
}

(() => {
  // En SSR o entornos sin DOM, Response puede no existir.
  if (typeof Response === "undefined") return;

  const proto = Response.prototype as Response & {
    __json_patched__?: true;
    json: () => Promise<any>;
    text: () => Promise<string>;
  };

  if (!proto || proto.__json_patched__) return;

  // Nota: no usamos el json original; consumimos el body con .text() como hace .json()
  proto.json = async function jsonSafe(this: Response): Promise<any> {
    try {
      const text = await this.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    } catch {
      return {};
    }
  };

  Object.defineProperty(proto, "__json_patched__", {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
})();

// Parche extra: envolver fetch para impedir logouts automáticos no deseados
(() => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  const originalFetch = window.fetch.bind(window);

  function getHeader(init: RequestInit | undefined, name: string): string | null {
    if (!init?.headers) return null;
    const h = init.headers as any;
    if (h instanceof Headers) return h.get(name);
    const lower = name.toLowerCase();
    if (Array.isArray(h)) {
      for (const [k, v] of h) if (String(k).toLowerCase() === lower) return String(v);
      return null;
    }
    if (typeof h === 'object') {
      for (const k of Object.keys(h)) if (k.toLowerCase() === lower) return String((h as any)[k]);
    }
    return null;
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const urlStr = typeof input === 'string' ? input : (input as URL).toString();
      const url = new URL(urlStr, window.location.origin);
      // Detectar intento de logout
      if (/\/api\/auth\/logout$/.test(url.pathname)) {
        const origin = getHeader(init, 'X-Logout-Origin');
        const now = Date.now();
        const suppressUntil = (window as any).__suppressLogoutUntil ?? 0;
        if (origin !== 'ui' && now < suppressUntil) {
          // Bloquear logout "automático" dentro de la ventana de gracia post-login
          console.log('[SafeFetch] Logout bloqueado (ventana post-login activa). origin=', origin);
          return new Response(JSON.stringify({ ok: true, skipped: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    } catch {
      // si falla el parseo del URL, continuar
    }
    return originalFetch(input as any, init as any);
  };
})();

export {};
