// server/utils/lh.ts
//
// Utilidades robustas para unificar lectura de resultados de Lighthouse/PageSpeed
// tanto cuando provienen del PSI (raw.lighthouseResult) como cuando son LHR local (raw).
// Incluye helpers para colores/umbrales, lectura de métricas, categorías y oportunidades,
// y un pequeño resumen de auditorías para depuración.
//
// ⚠️ IMPORTANTE:
// - Mantiene los exports esperados por tu gateway/controladores:
//     readMetrics(doc)                 -> métricas normalizadas
//     extractOpportunities(doc)        -> plan de acción (oportunidades)
// - Añade funciones auxiliares no rompientes:
//     readCategoryScoresFromApi(api)   -> performance/a11y/best-practices/seo en %
//     pickAudits(api)                  -> acceso uniforme a audits
//     summarizeAudit(doc)              -> resumen debug opcional
//
// No elimina nada funcional: puedes pegar este archivo completo.

export type Color = "green" | "amber" | "red" | "gray";
export type Trend = "up" | "down" | "same";

// -------------------------------
//  Umbrales (ajústalos si quieres)
// -------------------------------
type TimeThreshold = { green: number; amber: number };

export const THRESHOLDS: {
  performance: { green: number; amber: number }; // %
  fcp: TimeThreshold;   // s
  lcp: TimeThreshold;   // s
  tbt: { green: number; amber: number }; // ms
  si: TimeThreshold;    // s
  ttfb: TimeThreshold;  // s
} = {
  performance: { green: 90,  amber: 50 }, // %
  fcp:        { green: 1.8, amber: 3.0 }, // s
  lcp:        { green: 2.5, amber: 4.0 }, // s
  tbt:        { green: 200, amber: 600 }, // ms
  si:         { green: 3.4, amber: 5.8 }, // s
  ttfb:       { green: 0.8, amber: 1.8 }, // s
};

// -------------------------------
//  Helpers básicos
// -------------------------------
type MaybeNum = number | null | undefined;
const isNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

const toSec1 = (ms: MaybeNum): number | null =>
  isNum(ms) ? Math.round((ms / 1000) * 10) / 10 : null;

const fmtS = (s: MaybeNum): string | null =>
  isNum(s) ? `${Number(s).toFixed(2)}s` : null;

const fmtMs = (ms: MaybeNum): string | null =>
  isNum(ms) ? `${Math.round(ms)}ms` : null;

const fmtB = (b: MaybeNum): string | null => {
  if (!isNum(b)) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

// reemplaza tu función sum por esta
const sum = (arr: ReadonlyArray<unknown>): number => {
  let total = 0;
  for (const v of arr) {
    if (typeof v === "number" && !Number.isNaN(v)) total += v;
  }
  return total;
};

// -------------------------------
//  Colores / Tendencia
// -------------------------------
export function colorFor(
  key: "performance" | "fcp" | "lcp" | "tbt" | "si" | "ttfb" | string,
  val: number | null | undefined
): Color {
  if (val == null) return "gray";
  const t: any = (THRESHOLDS as any)[key];
  if (!t) return "gray";

  if (key === "performance") {
    return val >= t.green ? "green" : val >= t.amber ? "amber" : "red";
  }

  // Para tiempos, verde es cuanto MENORES mejor
  if (key === "tbt") {
    return val < t.green ? "green" : val <= t.amber ? "amber" : "red";
  }
  return val < t.green ? "green" : val <= t.amber ? "amber" : "red";
}

/** Calcula tendencia simple entre dos valores (números). */
export function trendOf(
  key: "performance" | "fcp" | "lcp" | "tbt" | "si" | "ttfb",
  prev: MaybeNum,
  curr: MaybeNum,
  epsilon = 0.02
): Trend {
  if (!isNum(prev) || !isNum(curr)) return "same";
  // Para performance: mayor es mejor. Para tiempos: menor es mejor.
  if (key === "performance") {
    if (curr > prev * (1 + epsilon)) return "up";
    if (curr < prev * (1 - epsilon)) return "down";
    return "same";
  } else {
    if (curr < prev * (1 - epsilon)) return "up";
    if (curr > prev * (1 + epsilon)) return "down";
    return "same";
  }
}

// -------------------------------
//  Normalizador de LHR (PSI / local)
// -------------------------------
/** Devuelve el LighthouseResult (LHR) sin importar la forma del objeto. */
export function getLHR(doc: any): any | null {
  if (!doc) return null;

  // Posibles ubicaciones
  return (
    doc?.raw?.lighthouseResult ||         // PSI (micro pagespeed)
    doc?.raw ||                           // LHR local (cuando guardas rr.lhr)
    doc?.lighthouseResult ||              // por si guardaste nivel raíz
    doc?.result?.lhr ||                   // algunas libs anidan así
    doc?.result?.lighthouseResult ||
    doc?.data?.lhr ||
    doc?.data?.lighthouseResult ||
    null
  );
}

/** Devuelve audits del LHR sin importar la forma/ubicación. */
export function pickAudits(apiOrDoc: any): Record<string, any> {
  const lhr =
    apiOrDoc?.raw?.lighthouseResult ||
    apiOrDoc?.raw ||
    apiOrDoc?.lighthouseResult ||
    apiOrDoc?.result?.lhr ||
    apiOrDoc?.result?.lighthouseResult ||
    apiOrDoc?.data?.lhr ||
    apiOrDoc?.data?.lighthouseResult ||
    apiOrDoc?.lhr || // por si ya viene directo
    null;

  return (lhr?.audits || apiOrDoc?.audits || {}) as Record<string, any>;
}

// -------------------------------
//  Categorías (0..100)
// -------------------------------
export function readCategoryScoresFromApi(apiData: any): {
  performance: number | null;
  accessibility: number | null;
  "best-practices": number | null;
  seo: number | null;
} {
  // Si el micro ya lo precalculó (0..100)
  const direct = apiData?.categoryScores;
  if (direct && typeof direct === "object") {
    const v = (x: any) => (isNum(x) ? Math.round(x) : null);
    return {
      performance: v(direct.performance),
      accessibility: v(direct.accessibility),
      "best-practices": v(direct["best-practices"]),
      seo: v(direct.seo),
    };
  }

  // LHR crudo en múltiples ubicaciones
  const cats =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories ||
    null;

  const pct = (x?: number) => (isNum(x) ? Math.round(x * 100) : null);

  return {
    performance:     pct(cats?.performance?.score),
    accessibility:   pct(cats?.accessibility?.score),
    "best-practices":pct(cats?.["best-practices"]?.score),
    seo:             pct(cats?.seo?.score),
  };
}

// -------------------------------
/** Lectura de métricas normalizadas
 *  - performance: %
 *  - fcp, lcp, si, ttfb: segundos
 *  - tbt: milisegundos
 */
export function readMetrics(doc: any): {
  performance: number | null;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  si: number | null;
  ttfb: number | null;
} {
  // Soporta doc completo (con .audit) o el propio objeto pagespeed/unlighthouse
  const p = doc?.audit?.pagespeed || doc?.pagespeed || doc || {};
  const u = doc?.audit?.unlighthouse || doc?.unlighthouse || {};

  // PERFORMANCE: preferencia a categoryScores.performance (ya en %)
  const catPerf = isNum(p?.categoryScores?.performance) ? Math.round(p.categoryScores.performance) : null;

  let performance: number | null =
    catPerf ??
    (isNum(p?.performance) ? Math.round(p.performance) : null);

  if (performance == null) {
    // LHR crudo
    const lhr = getLHR(p);
    if (isNum(lhr?.categories?.performance?.score)) {
      performance = Math.round(lhr.categories.performance.score * 100);
    }
  }

  // Métricas en ms desde múltiples fuentes
  const readMs = (obj: any, key: "fcp" | "lcp" | "tbt" | "si" | "ttfb"): number | null => {
    if (obj?.metrics && isNum(obj.metrics[key])) return obj.metrics[key];
    if (isNum(obj?.[key])) return obj[key];

    const idMap: Record<typeof key, string> = {
      fcp: "first-contentful-paint",
      lcp: "largest-contentful-paint",
      tbt: "total-blocking-time",
      si:  "speed-index",
      ttfb:"server-response-time",
    };
    const lhr = getLHR(obj);
    const audits = lhr?.audits || {};
    const nv = audits?.[idMap[key]]?.numericValue;
    return isNum(nv) ? nv : null;
  };

  const fcpMs  = readMs(p, "fcp")  ?? readMs(u, "fcp");
  const lcpMs  = readMs(p, "lcp")  ?? readMs(u, "lcp");
  const tbtMs  = readMs(p, "tbt")  ?? readMs(u, "tbt");
  const siMs   = readMs(p, "si")   ?? readMs(u, "si");
  const ttfbMs = readMs(p, "ttfb") ?? readMs(u, "ttfb");

  return {
    performance,
    fcp:  toSec1(fcpMs),
    lcp:  toSec1(lcpMs),
    si:   toSec1(siMs),
    ttfb: toSec1(ttfbMs),
    tbt:  isNum(tbtMs) ? Math.round(tbtMs) : null,
  };
}

// -------------------------------
//  Oportunidades (plan de acción)
// -------------------------------
/** Recomendaciones cortas por id (opcional). */
const RECO: Record<string, string> = {
  "render-blocking-resources": "Difiere o inyecta en línea los recursos que bloquean el renderizado.",
  "unused-javascript": "Divide y carga bajo demanda el JS no crítico.",
  "uses-long-cache-ttl": "Aumenta la política de caché de assets estáticos.",
  "total-byte-weight": "Reduce el peso total de la página (imágenes, fuentes, JS/CSS).",
  "server-response-time": "Mejora el TTFB: caché, CDN, queries y render en servidor.",
  "first-contentful-paint": "Acelera el primer render (FCP): CSS crítico y font-display.",
  "largest-contentful-paint": "Optimiza el LCP: descubre y precarga el recurso clave.",
  "total-blocking-time": "Reduce tareas largas en el main thread (TBT).",
  "speed-index": "Optimiza la rapidez de pintura del contenido visible (SI).",
};

/** Etiqueta legible de ahorro a partir de details/displayValue. */
function toSavingsLabel(details: any, displayValue?: string): string {
  const ms    = isNum(details?.overallSavingsMs)    ? details.overallSavingsMs    : null;
  const bytes = isNum(details?.overallSavingsBytes) ? details.overallSavingsBytes : null;

  if (ms && ms > 0)   return ms >= 100 ? `${Math.round((ms/1000)*10)/10}s` : `${Math.round(ms)}ms`;
  if (bytes && bytes > 0) {
    const kb = bytes / 1024;
    return kb >= 1024 ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
  }
  return displayValue || "";
}

/** Extrae oportunidades relevantes (y diagnósticos con ahorro estimado). */
export function extractOpportunities(docOrApi: any): Array<{
  id: string;
  title: string;
  recommendation: string;
  savingsLabel?: string;
  impactScore?: number;
}> {
  const api = docOrApi?.audit?.pagespeed || docOrApi?.pagespeed || docOrApi || {};
  const auditsObj = pickAudits(api);
  const list = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));

  const out: Array<{
    id: string;
    title: string;
    recommendation: string;
    savingsLabel?: string;
    impactScore?: number;
  }> = [];

  for (const a of list) {
    const d = (a as any).details || {};
    const isOpp = d?.type === "opportunity";
    const ms: MaybeNum    = d?.overallSavingsMs;
    const bytes: MaybeNum = d?.overallSavingsBytes;

    if (isOpp || isNum(ms) || isNum(bytes) || (a as any).displayValue) {
      const savingsLabel = toSavingsLabel(d, (a as any).displayValue);
      const impactScore  = (isNum(ms) ? ms : 0) + (isNum(bytes) ? Math.min(bytes / 10, 1000) : 0);

      out.push({
        id: (a as any).id || "opportunity",
        title: (a as any).title || (a as any).id || "Oportunidad",
        recommendation: (a as any).description || "",
        savingsLabel,
        impactScore,
      });
    }
  }

  // Orden descendente por “impacto”
  out.sort((b, a) => (a.impactScore || 0) - (b.impactScore || 0));

  // Si no hubo nada, crea sugerencias mínimas por umbrales (fallback)
  if (out.length === 0) {
    const m = readMetrics(docOrApi);
    const ms = (s: number | null) => (isNum(s) ? Math.round(Number(s) * 1000) : null);

    if (isNum(m.lcp) && m.lcp > THRESHOLDS.lcp.amber) {
      out.push({ id: "largest-contentful-paint", title: "Mejorar LCP", recommendation: RECO["largest-contentful-paint"] });
    }
    const tbtMs = ms(m.tbt);
    if (isNum(tbtMs) && tbtMs > THRESHOLDS.tbt.amber) {
      out.push({ id: "total-blocking-time", title: "Reducir TBT", recommendation: RECO["total-blocking-time"] });
    }
    if (isNum(m.fcp) && m.fcp > THRESHOLDS.fcp.amber) {
      out.push({ id: "first-contentful-paint", title: "Mejorar FCP", recommendation: RECO["first-contentful-paint"] });
    }
    if (isNum(m.si) && m.si > THRESHOLDS.si.amber) {
      out.push({ id: "speed-index", title: "Mejorar Speed Index", recommendation: RECO["speed-index"] });
    }
    if (isNum(m.ttfb) && m.ttfb > THRESHOLDS.ttfb.amber) {
      out.push({ id: "server-response-time", title: "Reducir TTFB", recommendation: RECO["server-response-time"] });
    }
  }

  return out;
}

// -------------------------------
//  Depuración: resumen compacto
// -------------------------------
export function summarizeAudit(doc: any) {
  const lhr = getLHR(doc);
  const audits = lhr?.audits || {};
  const refs: Array<{ group?: string }> = lhr?.categories?.performance?.auditRefs || [];

  const pick = (id: string) => {
    const au: any = (audits as any)[id];
    if (!au) return null;
    const d = au.details || {};
    return {
      title: au.title,
      score: au.score,
      scoreDisplayMode: au.scoreDisplayMode,
      numericValue: au.numericValue,
      displayValue: au.displayValue,
      details: {
        type: d.type,
        overallSavingsMs: d.overallSavingsMs,
        overallSavingsBytes: d.overallSavingsBytes,
        itemsLen: Array.isArray(d.items) ? d.items.length : 0,
      }
    };
  };

  return {
    hasLHR: !!lhr,
    auditCount: Object.keys(audits).length,
    perfGroups: refs.reduce<Record<string, number>>((acc, r) => {
      const g = r.group || "none";
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {}),
    sampleAudits: {
      "render-blocking-resources": pick("render-blocking-resources"),
      "render-blocking-insight":   pick("render-blocking-insight"),
      "unused-javascript":         pick("unused-javascript"),
      "uses-long-cache-ttl":       pick("uses-long-cache-ttl"),
      "total-byte-weight":         pick("total-byte-weight"),
      "first-contentful-paint":    pick("first-contentful-paint"),
      "largest-contentful-paint":  pick("largest-contentful-paint"),
      "total-blocking-time":       pick("total-blocking-time"),
      "speed-index":               pick("speed-index"),
      "server-response-time":      pick("server-response-time") || pick("time-to-first-byte"),
    }
  };
}

export default {
  THRESHOLDS,
  colorFor,
  trendOf,
  getLHR,
  pickAudits,
  readCategoryScoresFromApi,
  readMetrics,
  extractOpportunities,
  summarizeAudit,
};
