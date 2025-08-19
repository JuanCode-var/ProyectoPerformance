// src/setupSafeFetch.ts
// Parche defensivo: si un Response no trae cuerpo JSON válido,
// .json() devolverá {} en vez de lanzar "Unexpected end of JSON input".
// Mantiene el contrato asincrónico y no rompe llamadas existentes.

declare global {
  interface Response {
    /** Marcador interno para evitar parchear dos veces */
    __json_patched__?: true;
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

export {};
