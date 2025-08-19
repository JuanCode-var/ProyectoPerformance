// server/utils/lh.ts

// -------------------------------
//  Umbrales (ajústalos si quieres)
// -------------------------------
export type Color = "green" | "amber" | "red" | "gray";
export type Trend = "up" | "down" | "same";

type TimeThreshold = { green: number; amber: number };

export const THRESHOLDS: {
  performance: { green: number; amber: number }; // %
  fcp: TimeThreshold;   // s
  lcp: TimeThreshold;   // s
  tbt: { green: number; amber: number }; // ms
  si: TimeThreshold;    // s
  ttfb: TimeThreshold;  // s
} = {
  performance: { green: 90, amber: 50 }, // %
  fcp:  { green: 1.8, amber: 3.0 },      // s
  lcp:  { green: 2.5, amber: 4.0 },      // s
  tbt:  { green: 200, amber: 600 },      // ms
  si:   { green: 3.4, amber: 5.8 },      // s
  ttfb: { green: 0.8, amber: 1.8 }       // s
};

// -------------------------------
//  Helpers
// -------------------------------
const toSec  = (ms: number | null | undefined): number | null =>
  ms == null ? null : +(ms / 1000).toFixed(2);

const fmtS   = (s: number | null | undefined): string | null =>
  s == null ? null : `${s.toFixed(2)}s`;

const fmtMs  = (ms: number | null | undefined): string | null =>
  ms == null ? null : `${Math.round(ms)}ms`;

const fmtB   = (b: number | null | undefined): string | null => {
  if (b == null) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const sum = (arr: ReadonlyArray<unknown>): number => {
  let s = 0;
  for (const n of arr) s += Number(n) || 0;
  return s;
};

// -------------------------------
//  Colores / Tendencia
// -------------------------------
export function colorFor(
  key: "performance" | "fcp" | "lcp" | "tbt" | "si" | "ttfb" | string,
  val: number | null | undefined
): Color {
  if (val == null) return "gray";
  const t = (THRESHOLDS as any)[key];
  if (!t) return "gray";
  if (key === "performance") {
    if (val >= t.green) return "green";
    if (val >= t.amber) return "amber";
    return "red";
  }
  // en tiempos: menor es mejor (TBT en ms; resto en s)
  if (key === "tbt") {
    if (val <= t.green) return "green";
    if (val <= t.amber) return "amber";
    return "red";
  }
  if (val <= t.green) return "green";
  if (val <= t.amber) return "amber";
  return "red";
}

export function trendFor(
  key: "performance" | "fcp" | "lcp" | "tbt" | "si" | "ttfb" | string,
  curr: number | null | undefined,
  prev: number | null | undefined
): Trend {
  if (prev == null || curr == null) return "same";
  if (key === "performance") return curr > prev ? "up" : curr < prev ? "down" : "same";
  // tiempos: menor es mejor
  return curr < prev ? "up" : curr > prev ? "down" : "same";
}

// -----------------------------------------
//  Detección del LighthouseResult (LHR)
// -----------------------------------------
export function getLHR(doc: any): any | null {
  const a = doc?.audit || {};
  const candidates = [
    a.pagespeed?.raw?.lighthouseResult,
    a.pagespeed?.lighthouseResult,
    a.unlighthouse?.raw?.lighthouseResult,
    a.unlighthouse?.lighthouseResult,
    a.unlighthouse?.raw?.lhr,
    a.unlighthouse?.lhr,
    doc?.raw?.lighthouseResult,
    doc?.raw?.lhr,
  ];
  return candidates.find(Boolean) || null;
}

// -----------------------------------------
//  Lectura de métricas normalizadas
//  - performance: %
//  - fcp, lcp, si, ttfb: segundos
//  - tbt: milisegundos
// -----------------------------------------
export function readMetrics(doc: any): {
  performance: number | null;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  si: number | null;
  ttfb: number | null;
} {
  const lhr = getLHR(doc);
  let performance: number | null = null;

  // distintas formas en que la guardas
  if (typeof doc?.performance === "number") {
    performance = Math.round(doc.performance);
  } else if (typeof doc?.audit?.pagespeed?.performance === "number") {
    const p = doc.audit.pagespeed.performance;
    performance = p <= 1 ? Math.round(p * 100) : Math.round(p);
  } else if (typeof lhr?.categories?.performance?.score === "number") {
    performance = Math.round(lhr.categories.performance.score * 100);
  }

  const m = doc?.metrics || {};
  const audits = lhr?.audits || {};

  const fcp  = m.fcp  != null ? toSec(m.fcp)  : toSec(audits["first-contentful-paint"]?.numericValue);
  const lcp  = m.lcp  != null ? toSec(m.lcp)  : toSec(audits["largest-contentful-paint"]?.numericValue);
  const tbt  = m.tbt  != null ? m.tbt         : (audits["total-blocking-time"]?.numericValue ?? null); // ms
  const si   = m.si   != null ? toSec(m.si)   : toSec(audits["speed-index"]?.numericValue);
  const ttfb = m.ttfb != null ? toSec(m.ttfb) :
    toSec(audits["server-response-time"]?.numericValue ?? audits["time-to-first-byte"]?.numericValue);

  return { performance, fcp, lcp, tbt, si, ttfb };
}

// -----------------------------------------------------
//  Oportunidades (clásicas + diagnostics/insights + fallback umbrales)
//  Devuelve [{ id, title, savingsLabel, impactScore, recommendation }]
// -----------------------------------------------------
export function extractOpportunities(doc: any): Array<{
  id: string;
  title: string;
  savingsLabel?: string | null;
  impactScore?: number;
  recommendation?: string | null;
}> {
  const lhr = getLHR(doc);
  const audits: Record<string, any> = lhr?.audits || {};
  if (!audits || !Object.keys(audits).length) return [];

  const out: Array<{
    id: string;
    title: string;
    savingsLabel?: string | null;
    impactScore?: number;
    recommendation?: string | null;
  }> = [];

  const secLabel = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  const push = ({
    id,
    title,
    savingMs = 0,
    savingBytes = 0,
    recommendation = null,
  }: {
    id: string;
    title?: string;
    savingMs?: number;
    savingBytes?: number;
    recommendation?: string | null;
  }) => {
    const savingsLabel =
      savingMs > 0 ? secLabel(savingMs) : savingBytes > 0 ? fmtB(savingBytes) : null;
    const impactScore = (savingMs || 0) + (savingBytes || 0) / 1024; // ranking simple
    if (!savingsLabel && !recommendation) return; // nada útil
    out.push({
      id,
      title: title || audits[id]?.title || id,
      savingsLabel: savingsLabel || undefined,
      impactScore,
      recommendation: recommendation || undefined,
    });
  };

  // 1) Oportunidades "clásicas": overallSavings* o wasted*
  for (const [id, a] of Object.entries(audits)) {
    const d: any = (a as any)?.details;
    if (!d) continue;
    const items = Array.isArray(d.items) ? d.items : [];
    const ms =
      (typeof d.overallSavingsMs === "number" ? d.overallSavingsMs : 0) +
      sum(items.map((it: any) => it.wastedMs || it.overallSavingsMs || 0));
    const bytes =
      (typeof d.overallSavingsBytes === "number" ? d.overallSavingsBytes : 0) +
      sum(items.map((it: any) => it.wastedBytes || it.overallSavingsBytes || 0));
    if ((ms > 0 || bytes > 0) && (a as any).score !== 1 && (a as any).scoreDisplayMode !== "notApplicable") {
      push({ id, title: (a as any).title, savingMs: ms, savingBytes: bytes });
    }
  }

  // 2) Diagnostics / insights frecuentes (sin savings explícito)
  const RECO: Record<string, string> = {
    "unused-javascript": "Eliminar JS no usado: tree-shaking, code-splitting y carga diferida.",
    "uses-long-cache-ttl": "Configurar Cache-Control/ETag y TTL adecuados en assets estáticos.",
    "total-byte-weight": "Reducir peso total: comprimir imágenes, minificar y dividir recursos.",
    "server-response-time": "Mejorar TTFB: caché/CDN/edge, optimizar DB, SSR con caché.",
    "render-blocking-insight": "Evitar bloqueos de render: defer/async, CSS crítico, preload.",
    "third-parties-insight": "Revisar terceros: carga diferida, limitar scripts pesados.",
    "dom-size": "Reducir tamaño del DOM: paginar/virtualizar, componentes más pequeños.",
  };
  const ensure = (id: string, fn: () => void) => { if (!out.find(o => o.id === id)) fn(); };

  ensure("unused-javascript", () => {
    const a = audits["unused-javascript"]; if (!a || a.score === 1) return;
    const bytes = a.details?.items ? sum(a.details.items.map((it: any) => it.wastedBytes || 0)) : 0;
    if (bytes > 0) push({ id: "unused-javascript", title: a.title, savingBytes: bytes, recommendation: RECO["unused-javascript"] });
  });

  ensure("uses-long-cache-ttl", () => {
    const a = audits["uses-long-cache-ttl"]; if (!a || a.score === 1) return;
    push({ id: "uses-long-cache-ttl", title: a.title, recommendation: RECO["uses-long-cache-ttl"] });
  });

  ensure("total-byte-weight", () => {
    const a = audits["total-byte-weight"]; if (!a) return;
    const bytes = a.numericValue || 0; // peso total de página como referencia
    push({ id: "total-byte-weight", title: a.title, savingBytes: bytes || 0, recommendation: RECO["total-byte-weight"] });
  });

  ensure("server-response-time", () => {
    const a = audits["server-response-time"] || audits["time-to-first-byte"]; if (!a || a.score === 1) return;
    const ms = typeof a.numericValue === "number" ? a.numericValue : 0;
    push({ id: "server-response-time", title: a.title, savingMs: ms, recommendation: RECO["server-response-time"] });
  });

  ["render-blocking-insight","third-parties-insight","dom-size"].forEach((id) => {
    const a = (audits as any)[id]; if (!a) return;
    push({ id, title: a.title, recommendation: RECO[id] || a.title });
  });

  // 3) Fallback por umbrales si aún no hay nada (usando los THRESHOLDS)
  if (out.length === 0) {
    const ms = (s: number) => Math.round(s * 1000);
    const addMetric = (id: string, ok: boolean, reco: string) => {
      const a = audits[id];
      const title = a?.title || id;
      if (!ok) push({ id, title, recommendation: reco });
    };
    if (audits["first-contentful-paint"]?.numericValue != null) {
      addMetric(
        "first-contentful-paint",
        audits["first-contentful-paint"].numericValue <= ms(THRESHOLDS.fcp.amber),
        "Reducir bloqueos de render, CSS crítico, precarga de fuentes."
      );
    }
    if (audits["largest-contentful-paint"]?.numericValue != null) {
      addMetric(
        "largest-contentful-paint",
        audits["largest-contentful-paint"].numericValue <= ms(THRESHOLDS.lcp.amber),
        "Optimizar recurso LCP (tamaño/formato/preload) y lazy-load para no críticos."
      );
    }
    if (audits["total-blocking-time"]?.numericValue != null) {
      addMetric(
        "total-blocking-time",
        audits["total-blocking-time"].numericValue <= THRESHOLDS.tbt.amber,
        "Partir JS pesado: code-splitting, lazy y evitar tareas largas en main thread."
      );
    }
    if (audits["speed-index"]?.numericValue != null) {
      addMetric(
        "speed-index",
        audits["speed-index"].numericValue <= ms(THRESHOLDS.si.amber),
        "Mejorar pintura temprana: CSS crítico, priorizar contenido above-the-fold."
      );
    }
    const ttfbAudit = audits["server-response-time"] || audits["time-to-first-byte"];
    if (ttfbAudit?.numericValue != null) {
      addMetric(
        "server-response-time",
        ttfbAudit.numericValue <= ms(THRESHOLDS.ttfb.amber),
        "Bajar TTFB: caché en edge/CDN, optimizar backend/DB y mantener caliente."
      );
    }
  }

  // Orden por impacto
  out.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
  return out;
}

// -----------------------------------------
//  Empaquetado para el frontend (colores + tendencia)
// -----------------------------------------
export function packMetrics(
  curr: Record<string, any>,
  prev?: Record<string, any> | null
): Array<{
  key: string;
  raw: number | null | undefined;
  display: string | number | null;
  color: Color;
  trend: Trend;
}> {
  const order = ["performance", "fcp", "lcp", "tbt", "si", "ttfb"];
  return order.map((key) => {
    const raw = curr[key];
    const prevVal = prev?.[key] ?? null;

    let display: string | number | null = raw as any;
    if (key === "performance" && raw != null) display = `${Math.round(raw)}%`;
    else if (key === "tbt" && raw != null)    display = fmtMs(raw);
    else if (raw != null)                     display = fmtS(raw as number);

    return {
      key,
      raw,
      display,
      color: colorFor(key, raw),
      trend: trendFor(key, raw, prevVal)
    };
  });
}

// -----------------------------------------
//  Debug opcional (?debug=1)
// -----------------------------------------
export function debugOpportunities(doc: any): {
  hasLHR: boolean;
  auditCount: number;
  perfGroups: Record<string, number>;
  sampleAudits: Record<string, any>;
} {
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
      "render-blocking-insight":  pick("render-blocking-insight"),
      "unused-javascript":        pick("unused-javascript"),
      "uses-long-cache-ttl":      pick("uses-long-cache-ttl"),
      "total-byte-weight":        pick("total-byte-weight"),
      "first-contentful-paint":   pick("first-contentful-paint"),
      "largest-contentful-paint": pick("largest-contentful-paint"),
      "total-blocking-time":      pick("total-blocking-time"),
      "speed-index":              pick("speed-index"),
      "server-response-time":     pick("server-response-time") || pick("time-to-first-byte"),
    }
  };
}
