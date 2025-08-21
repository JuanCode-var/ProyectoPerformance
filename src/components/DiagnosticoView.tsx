// ——— src/components/DiagnosticoView.tsx ———
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CircularGauge from "./CircularGauge";
import ActionPlanPanel from "./ActionPlanPanel";
import EmailSendBar from "./EmailPdfBar";

// 👇 usa alias para no chocar con tus funciones locales
import {
  tTitle as i18nTitle,
  tRich as i18nRich,
  tSavings as i18nSavings,
} from "../../microPagespeed/src/lib/lh-i18n-es";

const API_LABELS: Record<string, string> = {
  pagespeed: "Lighthouse",
  unlighthouse: "Unlighthouse",
};

// =============== Utils ===============
async function safeParseJSON(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text || "{}"); } catch { return { _raw: text }; }
}
type MetricId =
  | "performance" | "fcp" | "lcp" | "tbt" | "si" | "ttfb"
  | "accessibility" | "best-practices" | "seo" | string;
type Trend = "up" | "down" | "flat" | string;

const trendSymbol = (t?: Trend) => (t === "up" ? "↑" : t === "down" ? "↓" : "→");
const trendColor  = (t?: Trend) => (t === "up" ? "#16a34a" : t === "down" ? "#ef4444" : "#6b7280");
const toSeconds = (ms: number | null | undefined): number | null =>
  typeof ms === "number" && !Number.isNaN(ms) ? Math.round((ms / 1000) * 10) / 10 : null;

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

function readCategoryScoresFromApi(apiData: any): {
  performance: number | null; accessibility: number | null;
  "best-practices": number | null; seo: number | null;
} {
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

// =============== Tipos ===============
type ProcessedMetric = { key: string; raw: number | null; trend?: Trend };
type ProcessedData = {
  metrics?: ProcessedMetric[] | Record<string, { raw?: number; trend?: Trend } | number>;
  errors?: any[]; improvements?: any[]; opportunities?: any[];
};
type AuditEnvelope = {
  url?: string; fecha?: string; email?: string;
  strategy?: "mobile" | "desktop" | string; audit?: Record<string, any>;
};

// ===== Helpers i18n para listas crudas de categorías
type CatBreakItem = {
  id: string;
  title: string;
  scorePct: number | null;
  displayValue?: string;
  description?: string;
  savingsLabel?: string;
};
const translateList = (list: any[] | undefined): CatBreakItem[] =>
  Array.isArray(list)
    ? list.map((it: any) => ({
        ...it,
        title: i18nTitle(it?.title || it?.id || ""),
        description: i18nRich(it?.description || ""),
      }))
    : [];

// =============== Builders (plan de acción) ===============
function buildFindings(apiData: any, processed: ProcessedData | null) {
  const fromProc = {
    errors: Array.isArray(processed?.errors) ? processed!.errors : [],
    improvements: Array.isArray(processed?.improvements) ? processed!.improvements : [],
  };
  if (fromProc.errors.length || fromProc.improvements.length) return fromProc;

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));

  const errors: any[] = [], improvements: any[] = [];
  for (const a of all) {
    if (a?.scoreDisplayMode === "manual" || a?.scoreDisplayMode === "notApplicable") continue;
    const item = {
      id: (a as any).id,
      title: i18nTitle((a as any).title || (a as any).id),          // 👈 i18n
      description: i18nRich((a as any).description || ""),          // 👈 i18n
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
      ...o,
      title: i18nTitle(o.title || o.id),                 // 👈 i18n
      recommendation: i18nRich(o.recommendation || ""),  // 👈 i18n
    }));
  }
  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));
  const opps: any[] = [];
  for (const a of all) {
    const d = (a as any).details || {};
    const hasOppType = d.type === "opportunity";
    const ms = typeof d.overallSavingsMs === "number" ? d.overallSavingsMs : null;
    const by = typeof d.overallSavingsBytes === "number" ? d.overallSavingsBytes : null;
    if (hasOppType || ms != null || by != null) {
      let savingsLabel = i18nSavings((a as any).displayValue || ""); // 👈 i18n savings
      if (!savingsLabel) {
        if (ms != null && ms > 0) savingsLabel = ms >= 100 ? `${Math.round((ms/1000)*10)/10}s` : `${Math.round(ms)}ms`;
        else if (by != null && by > 0) {
          const kb = by/1024; savingsLabel = kb >= 1024 ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
        }
      }
      opps.push({
        id: (a as any).id,
        title: i18nTitle((a as any).title || (a as any).id),    // 👈 i18n
        recommendation: i18nRich((a as any).description || ""), // 👈 i18n
        savingsLabel,
        impactScore: (ms || 0) + (by ? Math.min(by/10, 1000) : 0),
        type: "improvement", severity: "info",
      });
    }
  }
  opps.sort((b, a) => ((a as any).impactScore || 0) - ((b as any).impactScore || 0));
  return opps;
}

// =============== Extra: desglose por categoría (A11y/BP/SEO) ===============
function getCategoryBreakdown(catKey: "accessibility" | "best-practices" | "seo", apiData: any): CatBreakItem[] {
  const categories =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories || null;

  const cat = categories?.[catKey];
  if (!cat || !Array.isArray(cat.auditRefs)) return [];

  const auditsObj = pickAudits(apiData);

  const items: CatBreakItem[] = cat.auditRefs.map((ref: any) => {
    const a = auditsObj?.[ref.id] || {};
    const s = typeof a.score === "number" ? Math.round(a.score * 100) : null;

    // savings
    let savingsLabel = "";
    const d = a.details || {};
    const ms = typeof d.overallSavingsMs === "number" ? d.overallSavingsMs : null;
    const by = typeof d.overallSavingsBytes === "number" ? d.overallSavingsBytes : null;
    if (ms != null && ms > 0) savingsLabel = ms >= 100 ? `${Math.round((ms/1000)*10)/10}s` : `${Math.round(ms)}ms`;
    else if (by != null && by > 0) {
      const kb = by/1024; savingsLabel = kb >= 1024 ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
    }

    return {
      id: ref.id,
      title: i18nTitle(a.title || ref.id),           // 👈 i18n
      scorePct: s,
      displayValue: a.displayValue || "",
      description: i18nRich(a.description || ""),    // 👈 i18n
      savingsLabel,
    };
  });

  // Orden: primero peores puntajes, luego por weight desc
  items.sort((A, B) => {
    const sA = A.scorePct ?? -1, sB = B.scorePct ?? -1;
    if (sA !== sB) return sA - sB;
    const wA = (cat.auditRefs.find((r: any) => r.id === A.id)?.weight ?? 0);
    const wB = (cat.auditRefs.find((r: any) => r.id === B.id)?.weight ?? 0);
    return wB - wA;
  });

  return items.slice(0, 9);
}

// UI de desglose de categoría
function CategoryBreakdown({
  label,
  items,
}: {
  label: string;
  items: CatBreakItem[];
}) {
  if (!items.length) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
        Desglose de {label}
      </h3>
      <div
        className="diagnostico-grid"
        style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}
      >
        {items.map((it) => (
          <div key={it.id} className="item" style={{ paddingTop: 12, paddingBottom: 12 }}>
            <h4 className="item-label" title={typeof it.description === "string" ? it.description : ""}>
              {it.title}
            </h4>
            <CircularGauge
              value={it.scorePct ?? 0}
              max={100}
              color={gaugeColor("performance", it.scorePct)}
              decimals={0}
              suffix="%"
              size={106}
            />
            <p className="item-desc" style={{ minHeight: 22 }}>
              {it.savingsLabel
                ? `Ahorro: ${it.savingsLabel}`
                : (it.displayValue || "—")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============== Halo de performance ===============
function PerformanceHalo({
  perf,
  breakdown,
}: {
  perf: { id: string; label: string; value: number | null; desc: string };
  breakdown: Array<{ id: string; label: string; value: number | null; desc: string }>;
}) {
  const W = 880, H = 420, cx = W/2, cy = H/2;
  const CENTER_W = 280, CENTER_H = 240;
  const R = 185;

  const wanted = ["fcp","lcp","ttfb","tbt","si"];
  const metricMap: Record<string, any> = {};
  breakdown.forEach(m => metricMap[m.id] = m);
  const ids = wanted.filter(k => metricMap[k]);
  const angles = [-90, -25, 25, 205, 155].slice(0, ids.length);

  const nodes = ids.map((id, i) => {
    const a = (angles[i] * Math.PI) / 180;
    return { ...metricMap[id], x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R };
  });

  return (
    <div className="card" style={{ position: "relative", width: "100%", overflow: "hidden" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
        Desglose de Performance
      </h3>

      <div style={{ position: "relative", width: W, height: H, margin: "0 auto" }}>
        {/* centro */}
        <div
          className="item"
          style={{
            position: "absolute",
            left: cx - CENTER_W/2, top: cy - CENTER_H/2,
            width: CENTER_W, height: CENTER_H,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <h4 className="item-label" style={{ marginBottom: 8 }}>{perf.label}</h4>
          <CircularGauge
            value={perf.value ?? 0}
            max={100}
            color={gaugeColor("performance", perf.value)}
            decimals={0}
            suffix="%"
            size={150}
          />
          <p className="item-desc" style={{ textAlign: "center", marginTop: 10 }}>
            {perf.value == null ? "N/A" : `${perf.value}%`} — {perf.desc}
          </p>
        </div>

        {/* nodos alrededor */}
        {nodes.map((n) => (
          <div
            key={n.id}
            className="item"
            style={{
              position: "absolute",
              left: n.x - 110, top: n.y - 70,
              width: 220, height: 140,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 12,
            }}
          >
            <h5 className="item-label" style={{ marginBottom: 6 }}>{n.label}</h5>
            <CircularGauge
              value={typeof n.value === "number" ? n.value : 0}
              max={n.id === "performance" ? 100 : undefined}
              color={gaugeColor(n.id, n.value)}
              decimals={n.id === "performance" ? 0 : 1}
              suffix={n.id === "performance" ? "%" : "s"}
              size={84}
            />
            <p className="item-desc" style={{ marginTop: 6 }}>
              {n.value == null ? "N/A" : n.id === "performance" ? `${n.value}%` : `${n.value.toFixed(1)}s`}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8, color: "#64748b", fontSize: 14 }}>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} /> 0–49
        </span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} /> 50–89
        </span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e" }} /> 90–100
        </span>
      </div>
    </div>
  );
}

// --- Mini componente para mostrar la captura de pantalla de Lighthouse ---
function ScreenshotPreview({ src }: { src: string | null }) {
  const [open, setOpen] = React.useState(false);
  if (!src) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 8
      }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          Vista previa (captura)
        </h3>
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer", fontWeight: 600
          }}
        >
          Abrir
        </button>
      </div>

      {/* Miniatura pequeña */}
      <img
        src={src}
        alt="Vista previa de la página"
        style={{
          width: 240, height: "auto", borderRadius: 12,
          display: "block", boxShadow: "0 1px 8px rgba(0,0,0,.06)"
        }}
      />

      {/* Modal para ver grande */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 16, padding: 16,
              maxWidth: "90vw", maxHeight: "90vh", boxShadow: "0 10px 30px rgba(0,0,0,.2)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb",
                  background: "#fff", cursor: "pointer", fontWeight: 600
                }}
              >
                Cerrar
              </button>
            </div>
            <img
              src={src}
              alt="Vista previa ampliada"
              style={{ maxWidth: "85vw", maxHeight: "80vh", borderRadius: 12, display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============== Componente principal ===============
export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id: string | null =
    (params as any)?.id || new URLSearchParams(location.search).get("id");

  const [auditData, setAuditData] = useState<AuditEnvelope | null>(null);
  const [err, setErr] = useState<string>("");
  const [activeApi, setActiveApi] = useState<string>("");
  const [processed, setProcessed] = useState<ProcessedData | null>(null);

  // toggles de desgloses
  const [showPerfDetails, setShowPerfDetails] = useState(true);
  const [showAccDetails, setShowAccDetails] = useState(false);
  const [showBPDetails,  setShowBPDetails]  = useState(false);
  const [showSeoDetails, setShowSeoDetails] = useState(false);

  const contenedorReporteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAuditData(null); setErr(""); setActiveApi(""); setProcessed(null);
    setShowAccDetails(false); setShowBPDetails(false); setShowSeoDetails(false);
    if (!id) return;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(id).trim());
    if (!isValidObjectId) { setErr("ID inválido"); return; }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${id}`);
        const payload = await safeParseJSON(res);
        if (!res.ok) throw new Error(payload.error || payload.message || payload._raw || `HTTP ${res.status}`);

        const available = Object.keys(payload.audit || {}).filter((k) => {
          const m = (payload.audit?.[k] || {}).metrics || payload.audit?.[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ["pagespeed","unlighthouse"] as const;
        const apis = ORDER.filter(k => available.includes(k));
        if (mounted) { setActiveApi(apis[0] || ""); setAuditData(payload); }

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
      } catch (e: any) { if (mounted) setErr(e?.message || String(e)); }
    })();
    return () => { mounted = false; };
  }, [id]);

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

  // processed helpers
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

  // tiempos base
  const fcpSec  = toSeconds(metrics.fcp)  ?? pVal("fcp");
  const lcpSec  = toSeconds(metrics.lcp)  ?? pVal("lcp");
  const siSec   = toSeconds(metrics.si)   ?? pVal("si");
  let   ttfbSec = toSeconds(metrics.ttfb) ?? pVal("ttfb");
  const tbtApiS   = toSeconds(metrics.tbt);
  const tbtProcMs = pVal("tbt");
  const tbtSec = tbtApiS != null ? tbtApiS : (typeof tbtProcMs === "number" ? Math.round((tbtProcMs/1000)*10)/10 : null);

  // Fallback TTFB
  if (ttfbSec == null || ttfbSec === 0) {
    try {
      const audits = pickAudits(apiData);
      const a = audits?.["server-response-time"] || audits?.["time-to-first-byte"] || audits?.["metrics"];
      const nv = a?.numericValue;
      if (typeof nv === "number" && nv >= 0) ttfbSec = Math.round((nv/1000)*10)/10;
      const items = a?.details?.items;
      const obs = Array.isArray(items) && items.length ? items[0]?.observedTimeToFirstByte : undefined;
      if ((ttfbSec == null || ttfbSec === 0) && typeof obs === "number") ttfbSec = Math.round((obs/1000)*10)/10;
      if (ttfbSec == null || ttfbSec === 0) {
        const dv = a?.displayValue as string | undefined;
        if (dv) {
          const m1 = dv.match(/([\d.,]+)\s*ms/i);
          const m2 = dv.match(/([\d.,]+)\s*s/i);
          if (m1) ttfbSec = Math.round((parseFloat(m1[1].replace(",","."))/1000)*10)/10;
          else if (m2) ttfbSec = Math.round(parseFloat(m2[1].replace(",","."))*10)/10;
        }
      }
    } catch {}
  }

  const trendByKey: Record<string, Trend | undefined> = {
    performance: pTrend("performance"),
    fcp: pTrend("fcp"), lcp: pTrend("lcp"), si: pTrend("si"),
    ttfb: pTrend("ttfb"), tbt: pTrend("tbt"),
  };

  const cats = readCategoryScoresFromApi(apiData);
  const pickPct = (prefer: number | null | undefined, key: "accessibility" | "best-practices" | "seo"): number | null =>
    typeof prefer === "number" ? Math.round(prefer) : (typeof pVal(key) === "number" ? Math.round(pVal(key)!) : null);
  const accessibilityPct = pickPct(cats.accessibility, "accessibility");
  const bestPracticesPct = pickPct(cats["best-practices"], "best-practices");
  const seoPct           = pickPct(cats.seo, "seo");

  // Tarjetas (grid principal)
  const perfCard = { id: "performance" as MetricId, label: "RENDIMIENTO", value: performance,
    desc: `Porcentaje de rendimiento según ${API_LABELS[activeApi]}.` };
  const categoryCards = [
    { id: "accessibility" as MetricId,  label: "ACCESIBILIDAD",       value: accessibilityPct, desc: "Buenas prácticas de accesibilidad (WAI-ARIA, contraste, labels, etc.)" },
    { id: "best-practices" as MetricId, label: "PRACTICAS RECOMEND.", value: bestPracticesPct, desc: "Seguridad y prácticas modernas de desarrollo" },
    { id: "seo" as MetricId,            label: "SEO",                 value: seoPct,           desc: "Buenas prácticas básicas de SEO" },
  ];

  // Desglose (solo aquí se muestran las métricas de tiempo)
  const perfBreakdown = [
    { id: "fcp" as MetricId,  label: "FCP",  value: fcpSec,  desc: "Tiempo hasta la primera pintura de contenido (s)" },
    { id: "lcp" as MetricId,  label: "LCP",  value: lcpSec,  desc: "Tiempo hasta la pintura de contenido más grande (s)" },
    { id: "tbt" as MetricId,  label: "TBT",  value: tbtSec,  desc: "Tiempo total de bloqueo (s)" },
    { id: "si"  as MetricId,  label: "SI",   value: siSec,   desc: "Índice de velocidad (s)" },
    { id: "ttfb" as MetricId, label: "TTFB", value: ttfbSec, desc: "Tiempo hasta el primer byte (s)" },
  ];

  // Desgloses por categoría (A11y/BP/SEO) desde LHR traducidos
  const accBreak = getCategoryBreakdown("accessibility", apiData);
  const bpBreak  = getCategoryBreakdown("best-practices", apiData);
  const seoBreak = getCategoryBreakdown("seo", apiData);

  const { errors: detectedErrors, improvements } = buildFindings(apiData, processed);
  const opportunities = buildOpportunities(apiData, processed);

  const mapFindingToOpp = (arr: any[], kind: "error" | "improvement") =>
    arr.map((e, i) => {
      let savingsLabel = i18nSavings(e.displayValue || "");
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
        title: i18nTitle(e.title || e.id || "Hallazgo"),
        recommendation: i18nRich(e.description || e.displayValue || ""),
        savingsLabel,
        type: kind,
        severity: kind === "error" ? "critical" : "info",
        impactScore:
          kind === "error" ? 2000 : typeof e.impactScore === "number" ? e.impactScore : 100,
      };
    });

    // Devuelve la captura final (base64) si está disponible en el LHR
  function getFinalScreenshot(apiData: any): string | null {
    const thumb =
      apiData?.raw?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data ||
      apiData?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data ||
      apiData?.raw?.audits?.["final-screenshot"]?.details?.data ||
      apiData?.audits?.["final-screenshot"]?.details?.data ||
      // fallback a la última miniatura si no hay final-screenshot
      apiData?.raw?.lighthouseResult?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data ||
      apiData?.lighthouseResult?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data ||
      apiData?.raw?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data ||
      apiData?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data;

    return (typeof thumb === "string" && thumb.startsWith("data:")) ? thumb : null;
  }

  const planItems = [
    ...opportunities.map((o) => ({
      type: "improvement" as const, severity: "info" as const, impactScore: 100,
      ...o,
      title: i18nTitle(o.title || o.id),                 // 👈 i18n consistente
      recommendation: i18nRich(o.recommendation || ""), // 👈 i18n consistente
    })),
    ...mapFindingToOpp(detectedErrors, "error"),
    ...mapFindingToOpp(improvements, "improvement"),
  ];

  const renderCard = (item: { id: MetricId; label: string; value: number | null; desc: string }) => {
    const isPct = ["performance","accessibility","best-practices","seo"].includes(item.id);
    const clickProps =
      item.id === "performance" ? { onClick: () => setShowPerfDetails(v => !v), style: { cursor: "pointer" } } :
      item.id === "accessibility" ? { onClick: () => setShowAccDetails(v => !v), style: { cursor: "pointer" } } :
      item.id === "best-practices" ? { onClick: () => setShowBPDetails(v => !v), style: { cursor: "pointer" } } :
      item.id === "seo" ? { onClick: () => setShowSeoDetails(v => !v), style: { cursor: "pointer" } } :
      {};
    return (
      <div key={item.id} className="item" {...clickProps}>
        <h3 className="item-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {item.label}
          {trendByKey[item.id] && <span style={{ fontSize: 12, color: trendColor(trendByKey[item.id]) }}>{trendSymbol(trendByKey[item.id])}</span>}
          {item.id === "performance" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {showPerfDetails ? "Ocultar desgloses" : "Mostrar desgloses"}
            </span>
          )}
          {item.id === "accessibility" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {showAccDetails ? "Ocultar desglose" : "Mostrar desglose"}
            </span>
          )}
          {item.id === "best-practices" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {showBPDetails ? "Ocultar desglose" : "Mostrar desglose"}
            </span>
          )}
          {item.id === "seo" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {showSeoDetails ? "Ocultar desglose" : "Mostrar desglose"}
            </span>
          )}
        </h3>
        <CircularGauge
          value={item.value ?? 0}
          max={isPct ? 100 : undefined}
          color={gaugeColor(item.id, item.value)}
          decimals={isPct ? 0 : 1}
          suffix={isPct ? "%" : "s"}
          size={120}
        />
        <p className="item-desc">
          {item.value == null ? "N/A" : isPct ? `${item.value}%` : `${(item.value as number).toFixed(1)}s`} — {item.desc}
        </p>
      </div>
    );
  };

  // ============ UI ============
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
        </div>

        {/* Grid principal: solo performance + categorías */}
        <div className="diagnostico-grid">
          {renderCard(perfCard)}
          {categoryCards.map(renderCard)}
        </div>

        {/* Desglose Performance */}
        {showPerfDetails && (
          <>
            <PerformanceHalo perf={perfCard} breakdown={perfBreakdown} />
            <ScreenshotPreview src={getFinalScreenshot(apiData)} />
          </>
        )}

        {/* Desglose Accesibilidad / Best Practices / SEO (traducción asegurada) */}
        {showAccDetails && (
          <CategoryBreakdown
            label="Accesibilidad"
            items={accBreak.length ? accBreak : translateList((apiData as any)?.accessibility?.items)}
          />
        )}

        {showBPDetails && (
          <CategoryBreakdown
            label="Prácticas recomendadas"
            items={bpBreak.length ? bpBreak : translateList((apiData as any)?.["best-practices"]?.items)}
          />
        )}

        {showSeoDetails && (
          <CategoryBreakdown
            label="SEO"
            items={seoBreak.length ? seoBreak : translateList((apiData as any)?.seo?.items)}
          />
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