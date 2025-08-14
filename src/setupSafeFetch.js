// src/setupSafeFetch.js
// Parche defensivo: si un Response no trae cuerpo JSON válido,
// .json() devolverá {} en vez de lanzar "Unexpected end of JSON input".
// Mantiene el contrato asincrónico y no rompe llamadas existentes.

// src/setupSafeFetch.js
(() => {
  if (Response && Response.prototype && !Response.prototype.__json_patched__) {
    const origJson = Response.prototype.json;
    Response.prototype.json = async function jsonSafe() {
      try {
        const text = await this.text();
        if (!text) return {};
        try { return JSON.parse(text); }
        catch { return {}; }
      } catch {
        return {};
      }
    };
    Object.defineProperty(Response.prototype, '__json_patched__', {
      value: true, enumerable: false, configurable: false, writable: false
    });
  }
})();

