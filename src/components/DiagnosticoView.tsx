import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import CircularGauge from "./CircularGauge";
import ActionPlanPanel from "./ActionPlanPanel";
import EmailSendBar from "./EmailPdfBar";

const API_LABELS: Record<string, string> = {
  pagespeed: "Lighthouse",
  unlighthouse: "Unlighthouse",
};

/* =========================
   Utils
   ========================= */
async function safeParseJSON(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text || "{}"); }
  catch { return { _raw: text }; }
}

const toSeconds = (ms: number | null | undefined): number | null =>
  typeof ms === "number" && !Number.isNaN(ms)
    ? Math.round((ms / 1000) * 10) / 10
    : null;

type MetricId =
  | "performance" | "fcp" | "lcp" | "tbt" | "si" | "ttfb"
  | "accessibility" | "best-practices" | "seo" | string;

type Trend = "up" | "down" | "flat" | string;

function gaugeColor(metricId: MetricId, value: number | null | undefined) {
  const green = "#22c55e", amber = "#f59e0b", red = "#ef4444", gray = "#9ca3af";
  if (value == null) return gray;
  if (["performance","accessibility","best-practices","seo"].includes(metricId)) {
    return value >= 90 ? green : value >= 50 ? amber : red;
  }
  switch (metricId) {
    case "fcp":  return value < 1.8 ? green : value <= 3.0 ? amber : red;
    case "lcp":  return value < 2.5 ? green : value <= 4.0 ? amber : red;
    case "tbt":  return value < 0.2 ? green : value <= 0.6 ? amber : red;
    case "si":   return value < 3.4 ? green : value <= 5.8 ? amber : red;
    case "ttfb": return value < 0.8 ? green : value <= 1.8 ? amber : red;
    default:     return amber;
  }
}
const trendSymbol = (t?: Trend) => (t === "up" ? "↑" : t === "down" ? "↓" : "→");
const trendColor  = (t?: Trend) => (t === "up" ? "#16a34a" : t === "down" ? "#ef4444" : "#6b7280");

/* ✅ Audits en cualquier forma (PSI remoto y Lighthouse local) */
function pickAudits(apiData: any): Record<string, any> {
  return (
    apiData?.raw?.lighthouseResult?.audits ||
    apiData?.raw?.audits ||
    apiData?.lighthouseResult?.audits ||
    apiData?.result?.lhr?.audits ||
    apiData?.result?.lighthouseResult?.audits ||
    apiData?.data?.lhr?.audits ||
    apiData?.data?.lighthouseResult?.audits ||
    apiData?.audits || {}
  );
}

/* 🔎 Lectura robusta de categorías (0..100) desde el objeto de API si están disponibles */
function readCategoryScoresFromApi(apiData: any): {
  performance: number | null; accessibility: number | null;
  "best-practices": number | null; seo: number | null;
} {
  const direct = apiData?.categoryScores;
  if (direct && typeof direct === "object") {
    const v = (x: any) => (typeof x === "number" && !Number.isNaN(x) ? Math.round(x) : null);
    return {
      performance: v(direct.performance),
      accessibility: v(direct.accessibility),
      "best-practices": v(direct["best-practices"]),
      seo: v(direct.seo),
    };
  }
  const cats =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories || null;
  const toPct = (x?: number) => (typeof x === "number" ? Math.round(x * 100) : null);
  return {
    performance: toPct(cats?.performance?.score),
    accessibility: toPct(cats?.accessibility?.score),
    "best-practices": toPct(cats?.["best-practices"]?.score),
    seo: toPct(cats?.seo?.score),
  };
}

/* =========================
   i18n ES (títulos + textos)
   ========================= */
const T_EXACT = new Map<string, string>([
  ["Use video formats for animated content","Usar formatos de video para contenido animado"],
  ["Avoid serving legacy JavaScript to modern browsers","Evitar servir JavaScript heredado a navegadores modernos"],
  ["Eliminate render-blocking resources","Eliminar recursos que bloquean el renderizado"],
  ["Avoid `document.write()`","Evitar `document.write()`"],
  ["Reduce unused JavaScript","Reducir JavaScript no utilizado"],
  ["Reduce unused CSS","Reducir CSS no utilizado"],
  ["Serve images in next-gen formats","Servir imágenes en formatos modernos"],
  ["Efficiently encode images","Codificar imágenes eficientemente"],
  ["Properly size images","Ajustar tamaño de imágenes"],
  ["Defer offscreen images","Diferir imágenes fuera de pantalla"],
  ["Preload key requests","Precargar solicitudes clave"],
  ["Avoid chaining critical requests","Evitar encadenamiento de solicitudes críticas"],
  ["Enable text compression","Habilitar compresión de texto"],
  ["Serve static assets with an efficient cache policy","Servir recursos estáticos con una política de caché eficiente"],
  ["Avoid enormous network payloads","Evitar cargas de red enormes"],
  ["Reduce server response times (TTFB)","Reducir el tiempo de respuesta del servidor (TTFB)"],
  ["Largest Contentful Paint element","Elemento de la pintura de contenido más grande (LCP)"],
  ["Render blocking requests","Solicitudes que bloquean el renderizado"],
  ["First Contentful Paint","Primera pintura con contenido (FCP)"],
  ["Largest Contentful Paint","Pintura de mayor contenido (LCP)"],
  ["Speed Index","Índice de velocidad (SI)"],
  ["Time to Interactive","Tiempo hasta interactivo (TTI)"],
  ["Total Blocking Time","Tiempo total de bloqueo (TBT)"],
  ["Network dependency tree","Árbol de dependencias de red"],
  ["Document request latency","Latencia de la solicitud del documento"],
  ["Preload Largest Contentful Paint image","Precargar la imagen de LCP"],
  ["Reduce the impact of third-party code","Reducir el impacto del código de terceros"],
  ["Minify CSS","Minificar CSS"],
  ["Minify JavaScript","Minificar JavaScript"],
  ["Remove duplicate modules in JavaScript bundles","Eliminar módulos duplicados en paquetes de JavaScript"],
  ["Initial server response time was short","El tiempo de respuesta inicial del servidor fue corto"],
  ["Page prevented back/forward cache restoration","La página impidió la restauración de la caché de retroceso/avance (bfcache)"],
  ["Legacy JavaScript","JavaScript heredado"],
  ["Avoids an excessive DOM size","Evita un tamaño de DOM excesivo"],
  ["Font display","Visualización de fuentes (font-display)"],
  ["Document uses legible font sizes","El documento usa tamaños de fuente legibles"],
  ["User Timing marks and measures","Marcadores y mediciones de User Timing"],
  ["Avoid long main-thread tasks","Evita tareas largas en el hilo principal"],
  ["Network Round Trip Times","Tiempos de ida y vuelta de red (RTT)"],
  ["Preconnect to required origins","Preconectar a orígenes necesarios"],
]);
function norm(s: unknown) {
  return String(s || "").toLowerCase().replace(/[`’'"]/g, "").replace(/\s+/g, " ").trim();
}
const T_SOFT = new Map<string, string>([
  ["render blocking requests","Solicitudes que bloquean el renderizado"],
  ["avoid serving legacy javascript to modern browsers","Evitar servir JavaScript heredado a navegadores modernos"],
  ["eliminate render blocking resources","Eliminar recursos que bloquean el renderizado"],
  ["reduce unused javascript","Reducir JavaScript no utilizado"],
  ["reduce unused css","Reducir CSS no utilizado"],
  ["serve images in next gen formats","Servir imágenes en formatos modernos"],
  ["efficiently encode images","Codificar imágenes eficientemente"],
  ["properly size images","Ajustar tamaño de imágenes"],
  ["defer offscreen images","Diferir imágenes fuera de pantalla"],
  ["avoid chaining critical requests","Evitar encadenamiento de solicitudes críticas"],
  ["enable text compression","Habilitar compresión de texto"],
  ["avoid enormous network payloads","Evitar cargas de red enormes"],
  ["reduce server response times (ttfb)","Reducir el tiempo de respuesta del servidor (TTFB)"],
  ["first contentful paint","Primera pintura con contenido (FCP)"],
  ["largest contentful paint","Pintura de mayor contenido (LCP)"],
  ["speed index","Índice de velocidad (SI)"],
  ["time to interactive","Tiempo hasta interactivo (TTI)"],
  ["total blocking time","Tiempo total de bloqueo (TBT)"],
  ["document request latency","Latencia de la solicitud del documento"],
  ["initial server response time was short","El tiempo de respuesta inicial del servidor fue corto"],
  ["legacy javascript","JavaScript heredado"],
  ["avoids an excessive dom size","Evita un tamaño de DOM excesivo"],
  ["font display","Visualización de fuentes (font-display)"],
  ["user timing marks and measures","Marcadores y mediciones de User Timing"],
  ["avoid long main-thread tasks","Evita tareas largas en el hilo principal"],
  ["network round trip times","Tiempos de ida y vuelta de red (RTT)"],
  ["preconnect to required origins","Preconectar a orígenes necesarios"],
]);

export function tTitle(s: unknown) {
  if (typeof s !== "string") return s as any;
  return T_EXACT.get(s) || T_SOFT.get(norm(s)) || s;
}

/** Reemplazos por frases comunes */
const REPL_LIST: Array<[RegExp, string]> = [
  [/^Keep the server response time for the main document short because all other requests depend on it\./gi,
   "Mantén corto el tiempo de respuesta del servidor para el documento principal, porque todas las demás solicitudes dependen de él."],
  [/^Image formats like WebP and AVIF often provide better compression than PNG or JPEG, which means faster downloads and less data consumption\./gi,
   "Los formatos de imagen como WebP y AVIF suelen ofrecer mejor compresión que PNG o JPEG, lo que implica descargas más rápidas y menor consumo de datos."],
  [/^Consider marking your touch and wheel event listeners as `passive` to improve your page's scroll performance\./gi,
   "Considera marcar tus listeners de eventos de toque y rueda como `passive` para mejorar el rendimiento del desplazamiento de la página."],
  [/^A forced reflow occurs when JavaScript queries geometric properties \(such as offsetWidth\) after styles have been invalidated by a change to the DOM state\./gi,
   "Se produce un reflujo forzado cuando JavaScript consulta propiedades geométricas (como offsetWidth) después de cambios en el DOM."],
  [/Cumulative Layout Shift measures the movement of visible elements within the viewport\./gi,
   "Cumulative Layout Shift (CLS) mide el movimiento de los elementos visibles dentro del viewport."],
  [/Largest Contentful Paint marks the time at which the largest text or image is painted\./gi,
   "Largest Contentful Paint (LCP) marca el momento en que se pinta el texto o imagen más grande."],
  [/First Contentful Paint marks the time at which the first text or image is painted\./gi,
   "First Contentful Paint (FCP) indica el momento en que se pinta el primer texto o imagen."],
];

function translateLinkAnchors(md: string): string {
  let out = md;
  out = out.replace(/\[Learn more\]\(([^)]+)\)/gi, "[Más información]($1)");
  out = out.replace(/\[More information\]\(([^)]+)\)/gi, "[Más información]($1)");
  out = out.replace(/\[Learn more about ([^\]]+)\]\(([^)]+)\)/gi, "[Más información sobre $1]($2)");
  out = out.replace(/\[Learn how to ([^\]]+)\]\(([^)]+)\)/gi, "[Aprende cómo $1]($2)");
  return out;
}
export function tRich(s: unknown) {
  if (typeof s !== "string" || !s) return s as any;
  let out = s;
  out = translateLinkAnchors(out);
  for (const [re, rep] of REPL_LIST) out = out.replace(re, rep);
  return out;
}

/* =========================
   Tipos “processed/audit”
   ========================= */
type ProcessedMetric = { key: string; raw: number | null; trend?: Trend };
type ProcessedData = {
  metrics?: ProcessedMetric[] | Record<string, { raw?: number; trend?: Trend } | number>;
  errors?: any[]; improvements?: any[]; opportunities?: any[];
};
type AuditEnvelope = {
  url?: string; fecha?: string; email?: string; strategy?: "mobile" | "desktop" | string;
  audit?: Record<string, any>;
};

/* =========================
   Builders (findings/opps)
   ========================= */
function buildFindings(apiData: any, processed: ProcessedData | null) {
  const fromProcessed = {
    errors: Array.isArray(processed?.errors) ? processed!.errors : [],
    improvements: Array.isArray(processed?.improvements) ? processed!.improvements : [],
  };
  if (fromProcessed.errors.length || fromProcessed.improvements.length) return fromProcessed;

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));

  const errors: any[] = [];
  const improvements: any[] = [];

  for (const a of all) {
    if (a?.scoreDisplayMode === "manual" || a?.scoreDisplayMode === "notApplicable") continue;
    const item = {
      id: (a as any).id,
      title: tTitle((a as any).title || (a as any).id),
      description: tRich((a as any).description || ""),
      displayValue: (a as any).displayValue || "",
      details: (a as any).details || null,
      score: typeof (a as any).score === "number" ? (a as any).score : null,
      typeHint: (a as any)?.details?.type || null,
    };
    if (typeof item.score === "number") {
      if (item.score < 0.5) errors.push(item);
      else if (item.score < 1) improvements.push(item);
    } else if (item.typeHint === "opportunity") {
      improvements.push(item);
    }
  }
  errors.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  improvements.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return { errors, improvements };
}
function buildOpportunities(apiData: any, processed: ProcessedData | null) {
  if (Array.isArray(processed?.opportunities) && processed!.opportunities!.length) {
    return processed!.opportunities!.map((o: any) => ({
      type: "improvement", severity: "info", impactScore: 100,
      ...o, title: tTitle(o.title || o.id), recommendation: tRich(o.recommendation || ""),
    }));
  }
  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));
  const opps: any[] = [];
  for (const a of all) {
    const d = (a as any).details || {};
    const hasOppType = d.type === "opportunity";
    const savingsMs = typeof d.overallSavingsMs === "number" ? d.overallSavingsMs : null;
    const savingsB  = typeof d.overallSavingsBytes === "number" ? d.overallSavingsBytes : null;
    if (hasOppType || savingsMs != null || savingsB != null) {
      let savingsLabel = "";
      if (savingsMs != null && savingsMs > 0) {
        savingsLabel = savingsMs >= 100 ? `${Math.round((savingsMs/1000)*10)/10}s` : `${Math.round(savingsMs)}ms`;
      } else if (savingsB != null && savingsB > 0) {
        const kb = savingsB/1024;
        savingsLabel = kb >= 1024 ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
      } else if ((a as any).displayValue) {
        savingsLabel = (a as any).displayValue;
      }
      opps.push({
        id: (a as any).id,
        title: tTitle((a as any).title || (a as any).id),
        recommendation: tRich((a as any).description || ""),
        savingsLabel,
        impactScore: (savingsMs || 0) + (savingsB ? Math.min(savingsB/10, 1000) : 0),
        type: "improvement", severity: "info",
      });
    }
  }
  opps.sort((b, a) => ((a as any).impactScore || 0) - ((b as any).impactScore || 0));
  return opps;
}

/* =========================
   Helpers – desglose Best Practices
   ========================= */
function getBestPracticeBreakdown(apiData: any): Array<{
  id: string; title: string; pass: boolean; score: number | null;
}> {
  const audits = pickAudits(apiData);
  const cats =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories || null;

  let ids: string[] = [];
  const refs = cats?.["best-practices"]?.auditRefs;
  if (Array.isArray(refs)) {
    ids = refs.map((r: any) => r?.id).filter(Boolean);
  } else {
    // Plan B: por grupo
    ids = Object.keys(audits).filter((k) => {
      const g = audits[k]?.group;
      return typeof g === "string" && g.startsWith("best-practices");
    });
  }

  const items = ids.map((id) => {
    const a = audits[id];
    const score = typeof a?.score === "number" ? a.score : null;
    const pass = score != null ? score >= 1 : a?.scoreDisplayMode === "notApplicable";
    return { id, title: tTitle(a?.title || id) as string, pass, score };
  });

  // Primero “Revisar”, luego OK
  items.sort((b, a) => Number(a.pass) - Number(b.pass));
  return items;
}

/* =========================
   COMPONENT
   ========================= */
export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id: string | null = (params as any)?.id || new URLSearchParams(location.search).get("id");

  const [auditData, setAuditData] = useState<AuditEnvelope | null>(null);
  const [err, setErr] = useState<string>("");
  const [activeApi, setActiveApi] = useState<string>("");
  const [processed, setProcessed] = useState<ProcessedData | null>(null);
  const [catScores, setCatScores] = useState<{ accessibility?: number|null; bestPractices?: number|null; seo?: number|null } | null>(null);

  // 👇 Toggles de desgloses
  const [showPerfDetails, setShowPerfDetails] = useState<boolean>(true);
  const [showBPDetails, setShowBPDetails] = useState<boolean>(false);

  const contenedorReporteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAuditData(null); setErr(""); setActiveApi(""); setProcessed(null); setCatScores(null);
    setShowBPDetails(false);
    if (!id) return;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(id).trim());
    if (!isValidObjectId) { setErr("ID inválido"); return; }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${id}`);
        const payload = await safeParseJSON(res);
        if (!res.ok) {
          const msg = payload.error || payload.message || payload._raw || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const available = Object.keys(payload.audit || {}).filter(k => {
          const m = (payload.audit?.[k] || {}).metrics || payload.audit?.[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ["pagespeed","unlighthouse"] as const;
        const apis = ORDER.filter(k => available.includes(k));

        if (mounted) { setActiveApi(apis[0] || ""); setAuditData(payload); }

        // processed
        if (payload.url) {
          const urlSafe = encodeURIComponent(payload.url as string);
          try {
            const r = await fetch(`/api/diagnostics/${urlSafe}/processed`);
            if (!r.ok) {
              if (r.status === 404 && (payload as any)?._id) {
                const r2 = await fetch(`/api/diagnostics/by-id/${(payload as any)._id}/processed`);
                const d2 = await safeParseJSON(r2);
                if (!r2.ok) throw new Error(d2.error || d2.message || d2._raw || `HTTP ${r2.status}`);
                if (mounted) setProcessed(d2);
              } else {
                const errData = await safeParseJSON(r);
                throw new Error(errData.error || errData.message || errData._raw || `HTTP ${r.status}`);
              }
            } else {
              const d = await safeParseJSON(r);
              if (mounted) setProcessed(d);
            }
          } catch (e) { console.warn("[diagnostics/processed] fetch error:", e); }
        }

        // categorías desde RAW si faltan
        if (payload.url) {
          const readCatsFromAny = (blob: any) => {
            const cats =
              blob?.raw?.lighthouseResult?.categories ||
              blob?.raw?.categories ||
              blob?.lighthouseResult?.categories ||
              blob?.categories || null;
            const toPct = (x?: number) => (typeof x === "number" ? Math.round(x * 100) : null);
            return {
              accessibility: toPct(cats?.accessibility?.score),
              bestPractices: toPct(cats?.["best-practices"]?.score),
              seo: toPct(cats?.seo?.score),
            };
          };
          const primeCats = readCatsFromAny((payload.audit || {})[apis[0] || ""]);
          const missingAll = (primeCats.accessibility == null) && (primeCats.bestPractices == null) && (primeCats.seo == null);
          if (missingAll) {
            try {
              let rRaw = await fetch(`/api/diagnostics/${encodeURIComponent(payload.url)}/raw`);
              if (!rRaw.ok && rRaw.status === 404 && (payload as any)?._id) {
                rRaw = await fetch(`/api/diagnostics/by-id/${(payload as any)._id}/raw`);
              }
              if (rRaw.ok) {
                const raw = await safeParseJSON(rRaw);
                const cats = readCatsFromAny(raw);
                if (mounted) setCatScores(cats);
              }
            } catch {}
          } else {
            if (mounted) setCatScores(primeCats);
          }
        }
      } catch (e: any) { if (mounted) setErr(e?.message || String(e)); }
    })();
    return () => { mounted = false; };
  }, [id]);

  // ======== UI states ========
  if (!id) return (
    <div className="card">
      <p className="error">Falta el ID del diagnóstico.</p>
      <Link to="/" className="back-link">← Volver</Link>
    </div>
  );

  if (err) return (
    <div className="card">
      <p className="error">Error: {err}</p>
      <Link to="/" className="back-link">← Volver</Link>
    </div>
  );

  if (!auditData) return (
    <div className="card loading-placeholder">
      <div className="spinner" />
      <p>Cargando diagnóstico…</p>
    </div>
  );

  // ======== Datos ========
  const { url, fecha, audit = {} } = auditData as any;
  const apiData = (audit as Record<string, any>)[activeApi] || {};
  const metrics = apiData.metrics || apiData;

  if (!activeApi || Object.keys(metrics).length === 0) {
    return (
      <div className="card">
        <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
        <Link to={`/historico?url=${encodeURIComponent(url)}`} className="back-link" style={{ marginLeft: "1rem" }}>
          Ver histórico de esta URL
        </Link>
        <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
        <p className="no-metrics">No se encontraron métricas para la API seleccionada.</p>
      </div>
    );
  }

  // ⚙️ helpers processed
  const pVal = (k: string): number | null => {
    const m: any = (processed as any)?.metrics;
    if (Array.isArray(m)) {
      const v = m.find((x: any) => x?.key === k)?.raw;
      return typeof v === "number" && !Number.isNaN(v) ? v : null;
    } else if (m && typeof m === "object") {
      const raw = (m as any)[k];
      const v = typeof raw === "number" ? raw : typeof raw?.raw === "number" ? raw.raw : null;
      return typeof v === "number" && !Number.isNaN(v) ? v : null;
    }
    return null;
  };
  const pTrend = (k: string): Trend | undefined => {
    const m: any = (processed as any)?.metrics;
    if (Array.isArray(m)) return m.find((x: any) => x?.key === k)?.trend as Trend | undefined;
    if (m && typeof m === "object") return (m as any)[k]?.trend as Trend | undefined;
    return undefined;
  };

  // Performance
  let performance: number | null = null;
  if (typeof apiData.performance === "number") performance = Math.round(apiData.performance);
  else if (typeof metrics.performance === "number") performance = Math.round(metrics.performance);
  else { const pv = pVal("performance"); if (typeof pv === "number") performance = Math.round(pv); }

  // tiempos base (s)
  const fcpSec  = toSeconds(metrics.fcp)  ?? pVal("fcp");
  const lcpSec  = toSeconds(metrics.lcp)  ?? pVal("lcp");
  const siSec   = toSeconds(metrics.si)   ?? pVal("si");
  let   ttfbSec = toSeconds(metrics.ttfb) ?? pVal("ttfb"); // <- puede venir 0

  // TBT (API ms -> s; processed guarda ms)
  const tbtApiS   = toSeconds(metrics.tbt);
  const tbtProcMs = pVal("tbt");
  const tbtSec =
    tbtApiS != null ? tbtApiS
    : typeof tbtProcMs === "number" ? Math.round((tbtProcMs / 1000) * 10) / 10
    : null;

  // 🔎 Fallback TTFB desde audits
  if (ttfbSec == null || ttfbSec === 0) {
    try {
      const audits = pickAudits(apiData);
      const a = audits?.["server-response-time"] || audits?.["time-to-first-byte"];
      const nv = a?.numericValue; // ms
      if (typeof nv === "number" && nv >= 0) {
        ttfbSec = Math.round((nv / 1000) * 10) / 10;
      } else if (typeof a?.displayValue === "string") {
        const m1 = a.displayValue.match(/([\d.,]+)\s*ms/i);
        const m2 = a.displayValue.match(/([\d.,]+)\s*s/i);
        if (m1) ttfbSec = Math.round((parseFloat(m1[1].replace(",", ".")) / 1000) * 10) / 10;
        else if (m2) ttfbSec = Math.round(parseFloat(m2[1].replace(",", ".")) * 10) / 10;
      }
    } catch { /* silencioso */ }
  }

  // tendencias
  const trendByKey: Record<string, Trend | undefined> = {
    performance: pTrend("performance"),
    fcp: pTrend("fcp"),
    lcp: pTrend("lcp"),
    si: pTrend("si"),
    ttfb: pTrend("ttfb"),
    tbt: pTrend("tbt"),
  };

  // Categorías (Accesibilidad, BP, SEO) con fallback RAW
  const catsFromApi = readCategoryScoresFromApi(apiData);
  const pickPct = (prefer: number | null | undefined, key: "accessibility"|"best-practices"|"seo"): number | null => {
    if (typeof prefer === "number") return Math.round(prefer);
    const rawHit = key === "accessibility" ? catScores?.accessibility
                  : key === "best-practices" ? catScores?.bestPractices
                  : catScores?.seo;
    if (typeof rawHit === "number") return Math.round(rawHit);
    const pv = pVal(key);
    return typeof pv === "number" ? Math.round(pv) : null;
  };
  const accessibilityPct  = pickPct(catsFromApi.accessibility, "accessibility");
  const bestPracticesPct  = pickPct(catsFromApi["best-practices"], "best-practices");
  const seoPct            = pickPct(catsFromApi.seo, "seo");

  // ====== Tarjetas ======
  const perfCard = {
    id: "performance" as MetricId,
    label: "RENDIMIENTO",
    value: performance,
    desc: `Porcentaje de rendimiento según ${API_LABELS[activeApi]}.`,
  };

  const categoryCards: Array<{ id: MetricId; label: string; value: number | null; desc: string }> = [
    { id: "accessibility",  label: "ACCESIBILIDAD",       value: accessibilityPct, desc: "Buenas prácticas de accesibilidad (WAI-ARIA, contraste, labels, etc.)" },
    { id: "best-practices", label: "PRACTICAS RECOMEND.", value: bestPracticesPct, desc: "Seguridad y prácticas modernas de desarrollo" },
    { id: "seo",            label: "SEO",                 value: seoPct,           desc: "Buenas prácticas básicas de SEO" },
  ];

  const perfBreakdown: Array<{ id: MetricId; label: string; value: number | null; desc: string }> = [
    { id: "fcp",  label: "FCP",  value: fcpSec,  desc: "Tiempo hasta la primera pintura de contenido (s)" },
    { id: "lcp",  label: "LCP",  value: lcpSec,  desc: "Tiempo hasta la pintura de contenido más grande (s)" },
    { id: "tbt",  label: "TBT",  value: tbtSec,  desc: "Tiempo total de bloqueo (s)" },
    { id: "si",   label: "SI",   value: siSec,   desc: "Índice de velocidad (s)" },
    { id: "ttfb", label: "TTFB", value: ttfbSec, desc: "Tiempo hasta el primer byte (s)" },
  ];

  const { errors: detectedErrors, improvements } = buildFindings(apiData, processed);
  const opportunities = buildOpportunities(apiData, processed);

  const mapFindingToOpp = (arr: any[], kind: "error" | "improvement") =>
    arr.map((e, i) => {
      let savingsLabel = e.displayValue || "";
      const ms = e?.details?.overallSavingsMs as number | undefined;
      const bytes = e?.details?.overallSavingsBytes as number | undefined;
      if (!savingsLabel && typeof ms === "number") {
        savingsLabel = ms >= 100 ? `${Math.round((ms / 1000) * 10) / 10}s` : `${Math.round(ms)}ms`;
      } else if (!savingsLabel && typeof bytes === "number") {
        const kb = bytes / 1024;
        savingsLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
      }
      return {
        id: e.id || `finding-${kind}-${i}`,
        title: tTitle(e.title || e.id || "Hallazgo"),
        recommendation: tRich(e.description || e.displayValue || ""),
        savingsLabel,
        type: kind,
        severity: kind === "error" ? "critical" : "info",
        impactScore: kind === "error" ? 2000 : typeof e.impactScore === "number" ? e.impactScore : 100,
      };
    });

  const planItems = [
    ...opportunities.map((o) => ({
      type: "improvement" as const, severity: "info" as const, impactScore: 100,
      ...o, title: tTitle(o.title || o.id), recommendation: tRich(o.recommendation || ""),
    })),
    ...mapFindingToOpp(detectedErrors, "error"),
    ...mapFindingToOpp(improvements, "improvement"),
  ];

  // ======== Render ========
  const renderCard = (item: { id: MetricId; label: string; value: number | null; desc: string }) => {
    const isPct = ["performance","accessibility","best-practices","seo"].includes(item.id);
    const clickProps =
      item.id === "performance"
        ? { onClick: () => setShowPerfDetails(v => !v), style: { cursor: "pointer" } }
        : item.id === "best-practices"
        ? { onClick: () => setShowBPDetails(v => !v), style: { cursor: "pointer" } }
        : {};
    return (
      <div key={item.id} className="item" {...clickProps}>
        <h3 className="item-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {item.label}
          {trendByKey[item.id] && (
            <span style={{ fontSize: 12, color: trendColor(trendByKey[item.id]) }}>
              {trendSymbol(trendByKey[item.id])}
            </span>
          )}
          {item.id === "performance" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {showPerfDetails ? "Ocultar desgloses" : "Mostrar desgloses"}
            </span>
          )}
          {item.id === "best-practices" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {showBPDetails ? "Ocultar desglose" : "Mostrar desglose"}
            </span>
          )}
        </h3>

        <CircularGauge
          value={item.value ?? 0}
          max={isPct ? 100 : undefined}
          color={gaugeColor(item.id, item.value)}
          decimals={isPct ? 0 : 1}
          suffix={isPct ? "%" : "s"}
        />
        <p className="item-desc">
          {item.value == null ? "N/A" : isPct ? `${item.value}%` : `${(item.value as number).toFixed(1)}s`} — {item.desc}
        </p>
      </div>
    );
  };

  // Desglose Best Practices
  const bpBreakdown = showBPDetails ? getBestPracticeBreakdown(apiData) : [];

  return (
    <div className="card">
      <div ref={contenedorReporteRef}>
        <Link to="/" className="back-link">Nuevo diagnóstico</Link>
        <Link to={`/historico?url=${encodeURIComponent(url as string)}`} className="back-link" style={{ marginLeft: "1rem" }}>
          Ver histórico de esta URL
        </Link>

        <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
        <div className="date">{new Date(fecha as string).toLocaleString()}</div>

        <div className="tabs">
          {Object.keys(audit as Record<string, any>).map((api) => (
            <button key={api} onClick={() => setActiveApi(api)} className={`tab-button${activeApi === api ? " active" : ""}`}>
              {API_LABELS[api] || api}
            </button>
          ))}
          <button onClick={() => setShowPerfDetails(v => !v)} className="tab-button" style={{ flex: "none" }}>
            {showPerfDetails ? "Ocultar desgloses" : "Mostrar desgloses"}
          </button>
          <button onClick={() => setShowBPDetails(v => !v)} className="tab-button" style={{ flex: "none" }}>
            {showBPDetails ? "Ocultar BP" : "Desglose BP"}
          </button>
        </div>

        <div className="diagnostico-grid">
          {renderCard(perfCard)}
          {categoryCards.map(renderCard)}
          {showPerfDetails && perfBreakdown.map(renderCard)}
        </div>

        {/* Panel de desglose Best Practices */}
        {showBPDetails && (
          <div className="gauge-card pdf-keep" style={{ marginTop: 16 }}>
            <h3 className="metrics-title">
              Desglose de Prácticas recomendadas
              {typeof bestPracticesPct === "number" ? ` — ${bestPracticesPct}%` : ""}
            </h3>
            {bpBreakdown.length ? (
              <ul className="metrics-list">
                {bpBreakdown.map((it) => (
                  <li key={it.id}>
                    {it.title}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        fontWeight: 700,
                        color: it.pass ? "#16a34a" : "#ef4444",
                      }}
                    >
                      {it.pass ? "OK" : "Revisar"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="item-desc" style={{ marginLeft: 8 }}>
                No hay información de desglose para esta ejecución.
              </p>
            )}
          </div>
        )}

        <ActionPlanPanel opportunities={planItems as any} performance={performance ?? undefined} />
      </div>

      <EmailSendBar
        captureRef={contenedorReporteRef as any}
        url={url as string}
        email={(auditData as any)?.email || ""}
        hideEmailInput={true}
        subject={`Diagnóstico de ${url}`}
        endpoint="/api/audit/send-diagnostic"
        includePdf={true}
      />
    </div>
  );
}