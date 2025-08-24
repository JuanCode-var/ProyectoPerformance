// ——— src/components/DiagnosticoView.tsx ———
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CircularGauge from "./CircularGauge";
import ActionPlanPanel from "./ActionPlanPanel";
import EmailSendBar from "./EmailPdfBar";

// i18n (usamos alias para no chocar con funciones locales)
import {
  tTitle as i18nTitle,
  tRich as i18nRich,
  tSavings as i18nSavings,
} from "../../microPagespeed/src/lib/lh-i18n-es";

// =================== Constantes UI ===================
const API_LABELS: Record<string, string> = {
  pagespeed: "Lighthouse",
  unlighthouse: "Unlighthouse",
};

// =================== Utils ===================
async function safeParseJSON(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { _raw: text };
  }
}

type MetricId =
  | "performance"
  | "fcp"
  | "lcp"
  | "tbt"
  | "si"
  | "ttfb"
  | "cls"
  | "accessibility"
  | "best-practices"
  | "seo"
  | string;

type Trend = "up" | "down" | "flat" | string;

const trendSymbol = (t?: Trend) => (t === "up" ? "↑" : t === "down" ? "↓" : "→");
const trendColor = (t?: Trend) =>
  t === "up" ? "#16a34a" : t === "down" ? "#ef4444" : "#6b7280";

const toSeconds = (ms: number | null | undefined): number | null =>
  typeof ms === "number" && !Number.isNaN(ms)
    ? Math.round((ms / 1000) * 10) / 10
    : null;

function gaugeColor(metricId: MetricId, value: number | null | undefined) {
  const green = "#22c55e",
    amber = "#f59e0b",
    red = "#ef4444",
    gray = "#9ca3af";
  if (value == null) return gray;
  if (["performance", "accessibility", "best-practices", "seo"].includes(metricId)) {
    return value >= 90 ? green : value >= 50 ? amber : red;
  }
  switch (metricId) {
    case "fcp":
      return value < 1.8 ? green : value <= 3.0 ? amber : red;
    case "lcp":
      return value < 2.5 ? green : value <= 4.0 ? amber : red;
    case "tbt":
      return value < 0.2 ? green : value <= 0.6 ? amber : red;
    case "si":
      return value < 3.4 ? green : value <= 5.8 ? amber : red;
    case "ttfb":
      return value < 0.8 ? green : value <= 1.8 ? amber : red;
    case "cls":
      return value < 0.1 ? green : value <= 0.25 ? amber : red;
    default:
      return amber;
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
    apiData?.audits ||
    {}
  );
}

function readCategoryScoresFromApi(apiData: any): {
  performance: number | null;
  accessibility: number | null;
  "best-practices": number | null;
  seo: number | null;
} {
  const cats =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories ||
    null;
  const toPct = (x?: number) => (typeof x === "number" ? Math.round(x * 100) : null);
  return {
    performance: toPct(cats?.performance?.score),
    accessibility: toPct(cats?.accessibility?.score),
    "best-practices": toPct(cats?.["best-practices"]?.score),
    seo: toPct(cats?.seo?.score),
  };
}

// 🔎 Detecta el form factor real del LHR retornado por la API
function detectFormFactor(apiData: any): "mobile" | "desktop" | undefined {
  const lhr =
    apiData?.raw?.lighthouseResult ||
    apiData?.lighthouseResult ||
    apiData?.result?.lhr ||
    apiData?.data?.lhr ||
    null;

  const cfg = lhr?.configSettings || {};
  const emu = cfg.emulatedFormFactor ?? cfg.formFactor;
  if (emu === "mobile" || emu === "desktop") return emu;

  if (cfg?.screenEmulation && typeof cfg.screenEmulation.mobile === "boolean") {
    return cfg.screenEmulation.mobile ? "mobile" : "desktop";
  }
  return undefined;
}

// Lee segundos directo desde audits del payload actual (ms→s; CLS unitless)
function getAuditSeconds(apiData: any, id: string): number | null {
  const audits = pickAudits(apiData);
  const a = audits?.[id];
  if (!a) return null;

  if (typeof a.numericValue === "number") {
    if (/cumulative-layout-shift|^cls$/i.test(id)) {
      return Math.round(a.numericValue * 100) / 100; // CLS
    }
    return toSeconds(a.numericValue);
  }
  const dv: string | undefined = a.displayValue;
  if (dv) {
    const m1 = dv.match(/([\d.,]+)\s*ms/i);
    const m2 = dv.match(/([\d.,]+)\s*s/i);
    if (m1) return Math.round((parseFloat(m1[1].replace(",", ".")) / 1000) * 10) / 10;
    if (m2) return Math.round(parseFloat(m2[1].replace(",", ".")) * 10) / 10;
  }
  return null;
}

// Intenta forzar el audit correcto por URL+strategy (pasa por tu FormController)
async function fetchAuditByUrlWithStrategy(url: string, strategy: "mobile" | "desktop", ts: number) {
  const urlSafe = encodeURIComponent(url);
  const headers = { "Cache-Control": "no-cache" };

  // Orden de candidatos: diagnostics → audit/by-url → form (ajusta si tu back ya tiene uno exacto)
  const candidates = [
    `/api/diagnostics/${urlSafe}/audit?strategy=${strategy}&_=${ts}`,
    `/api/audit/by-url?url=${urlSafe}&strategy=${strategy}&_=${ts}`,
    `/api/form/audit?url=${urlSafe}&strategy=${strategy}&_=${ts}`,
  ];

  for (const endpoint of candidates) {
    try {
      const r = await fetch(endpoint, { headers });
      if (r.ok) return await safeParseJSON(r);
    } catch {}
  }
  return null;
}

// =================== Tipos ===================
type ProcessedMetric = { key: string; raw: number | null; trend?: Trend };
type ProcessedData = {
  metrics?:
    | ProcessedMetric[]
    | Record<string, { raw?: number; trend?: Trend } | number>;
  errors?: any[];
  improvements?: any[];
  opportunities?: any[];
};
type AuditEnvelope = {
  url?: string;
  fecha?: string;
  email?: string;
  strategy?: "mobile" | "desktop" | string;
  audit?: Record<string, any>;
};

// =================== i18n helpers para listas ===================
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
        id: String(it?.id ?? ""),
        title: i18nTitle(it?.title || it?.id || ""),
        scorePct:
          typeof it?.scorePct === "number"
            ? it.scorePct
            : typeof it?.score === "number"
            ? Math.round(it.score * 100)
            : null,
        displayValue: it?.displayValue || "",
        description: i18nRich(it?.description || ""),
        savingsLabel: it?.savingsLabel || "",
      }))
    : [];

// =================== Builders (hallazgos / plan) ===================
function buildFindings(apiData: any, processed: ProcessedData | null) {
  const fromProc = {
    errors: Array.isArray(processed?.errors) ? processed!.errors : [],
    improvements: Array.isArray(processed?.improvements) ? processed!.improvements : [],
  };
  if (fromProc.errors.length || fromProc.improvements.length) return fromProc;

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));

  const errors: any[] = [],
    improvements: any[] = [];
  for (const a of all) {
    if (a?.scoreDisplayMode === "manual" || a?.scoreDisplayMode === "notApplicable")
      continue;
    const item = {
      id: (a as any).id,
      title: i18nTitle((a as any).title || (a as any).id),
      description: i18nRich((a as any).description || ""),
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
      type: "improvement",
      severity: "info",
      impactScore: 100,
      ...o,
      title: i18nTitle(o.title || o.id),
      recommendation: i18nRich(o.recommendation || ""),
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
      let savingsLabel = i18nSavings((a as any).displayValue || "");
      if (!savingsLabel) {
        if (ms != null && ms > 0)
          savingsLabel = ms >= 100 ? `${Math.round((ms / 1000) * 10) / 10}s` : `${Math.round(ms)}ms`;
        else if (by != null && by > 0) {
          const kb = by / 1024;
          savingsLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
        }
      }

      opps.push({
        id: (a as any).id,
        title: i18nTitle((a as any).title || (a as any).id),
        recommendation: i18nRich((a as any).description || ""),
        savingsLabel,
        impactScore: (ms || 0) + (by ? Math.min(by / 10, 1000) : 0),
        type: "improvement",
        severity: "info",
      });
    }
  }

  opps.sort((b, a) => ((a as any).impactScore || 0) - ((b as any).impactScore || 0));
  return opps;
}

// =================== Desglose por categoría (A11y/BP/SEO) ===================
// ⚠️ ESTE ES EL COMPONENTE QUE TE FALTABA
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
      <div className="diagnostico-grid">
        {items.map((it) => {
          const isNull = it.scorePct == null;
          return (
            <div key={it.id} className="item">
              <h4
                className="item-label"
                title={typeof it.description === "string" ? it.description : ""}
              >
                {it.title}
              </h4>
              <CircularGauge
                value={isNull ? 0 : it.scorePct!}
                max={100}
                color={isNull ? "#9ca3af" : gaugeColor("performance", it.scorePct)}
                decimals={0}
                suffix="%"
                size={120}
              />
              <p className="item-desc">
                {isNull
                  ? "—"
                  : it.savingsLabel
                  ? `Ahorro: ${it.savingsLabel}`
                  : it.displayValue || "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Devuelve items de categoría desde el LHR
function getCategoryBreakdown(
  catKey: "accessibility" | "best-practices" | "seo",
  apiData: any
): CatBreakItem[] {
  const categories =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories ||
    null;

  const cat = categories?.[catKey];
  if (!cat || !Array.isArray(cat.auditRefs)) return [];

  const auditsObj = pickAudits(apiData);

  const items = cat.auditRefs
    .map((ref: any) => {
      const a = auditsObj?.[ref.id] || {};
      const sdm: string | undefined = a.scoreDisplayMode;
      if (sdm === "notApplicable" || sdm === "manual") return null;

      const s =
        typeof a.score === "number"
          ? Math.round(a.score * 100)
          : null;

      // savings
      let savingsLabel = "";
      const d = a.details || {};
      const ms = typeof d.overallSavingsMs === "number" ? d.overallSavingsMs : null;
      const by = typeof d.overallSavingsBytes === "number" ? d.overallSavingsBytes : null;

      if (ms != null && ms > 0) {
        savingsLabel = ms >= 100 ? `${Math.round((ms / 1000) * 10) / 10}s` : `${Math.round(ms)}ms`;
      } else if (by != null && by > 0) {
        const kb = by / 1024;
        savingsLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
      }

      return {
        id: String(ref.id),
        title: i18nTitle(a.title || ref.id),
        scorePct: s,
        displayValue: a.displayValue || "",
        description: i18nRich(a.description || ""),
        savingsLabel,
      } as CatBreakItem;
    })
    .filter(Boolean) as CatBreakItem[];

  items.sort((A, B) => {
    const sA = A.scorePct ?? -1,
      sB = B.scorePct ?? -1;
    if (sA !== sB) return sA - sB;
    const wA = cat.auditRefs.find((r: any) => r.id === A.id)?.weight ?? 0;
    const wB = cat.auditRefs.find((r: any) => r.id === B.id)?.weight ?? 0;
    return wB - wA;
  });

  return items.slice(0, 9);
}

// =================== PerfDial helpers ===================
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  const x1 = cx + r * Math.cos(s);
  const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy + r * Math.sin(e);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

// PerfDial (REEMPLAZO)
type DialSeg = { id: MetricId; label: string; value: number | null };

function PerfDial({
  score,
  segments,
  size = 140,
}: {
  score: number | null;
  segments: DialSeg[];
  size?: number;
}) {
  const W = size + 28;
  const H = size + 28;
  const cx = W / 2;
  const cy = H / 2 + 2;

  const strokeW = Math.max(8, Math.round(size * 0.083));
  const segR = size * 0.42;
  const innerR = size * 0.34;
  const numFont = Math.round(size * 0.285);
  const pctFont = Math.round(numFont * 0.47);

  const trackColor = "#e5e7eb";
  const numberColor = "#334155";

  const makeArc = (r: number, startDeg: number, endDeg: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = endDeg > startDeg ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
  };

  const layout: Record<string, [number, number, number]> = {
    si:  [-110, -70, -90],
    fcp: [ -40,   0, -20],
    lcp: [  20,  60,  40],
    cls: [ 140, 200, 170],
    tbt: [ 210, 250, 230],
  };
  const segs = segments.filter((s) => layout[s.id]);

  return (
    <div style={{ width: "100%", display: "grid", placeItems: "center" }}>
      <svg width={W} height={H}>
        <circle cx={cx} cy={cy} r={segR} fill="none" stroke={trackColor} strokeWidth={strokeW} />
        {segs.map((s) => {
          const [a1, a2, la] = layout[s.id];
          const col = gaugeColor(s.id, s.value);
          return (
            <g key={s.id}>
              <path
                d={makeArc(segR, a1, a2)}
                stroke={col}
                strokeWidth={strokeW}
                fill="none"
                strokeLinecap="round"
              />
              <text
                x={cx + (segR + strokeW * 0.9) * Math.cos((la * Math.PI) / 180)}
                y={cy + (segR + strokeW * 0.9) * Math.sin((la * Math.PI) / 180)}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: Math.round(size * 0.083), fill: "#111827", fontWeight: 700, fontFamily: "inherit" }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={innerR} fill="#ffffff" />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          style={{
            fontSize: numFont,
            fontWeight: 800,
            fill: numberColor,
            fontFamily: "inherit",
            letterSpacing: "0.2px",
          }}
        >
          {typeof score === "number" ? (
            <>
              {score}
              <tspan style={{ fontSize: pctFont, fontWeight: 700, fontFamily: "inherit" }}>%</tspan>
            </>
          ) : (
            "—"
          )}
        </text>
      </svg>
    </div>
  );
}

// =================== Desglose de Performance (grid tipo SEO) ===================
const perfMetricDescriptions: Record<string, string> = {
  fcp: "Tiempo hasta la primera pintura de contenido.",
  lcp: "Tiempo hasta la pintura del elemento con contenido más grande.",
  tbt: "Tiempo total de bloqueo durante la carga.",
  si:  "Índice de velocidad percibida durante el render.",
  ttfb: "Tiempo que tarda el servidor en enviar el primer byte.",
  cls: "Estabilidad visual (desplazamientos acumulados).",
};

function PerfBreakdownGrid({
  items,
}: {
  items: Array<{ id: MetricId; label: string; value: number | null }>;
}) {
  if (!items.length) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
        Desglose de Performance
      </h3>
      <div className="diagnostico-grid">
        {items.map((m) => {
          const isTime = m.id !== "performance" && m.id !== "cls";
          const isCLS = m.id === "cls";
          const v = m.value;
          const subtitle = perfMetricDescriptions[m.id] || "";
          return (
            <div key={m.id} className="item">
              <h4 className="item-label">{m.label}</h4>
              <CircularGauge
                value={
                  v == null
                    ? 0
                    : isTime
                    ? Number(v.toFixed(1))
                    : isCLS
                    ? Number((v ?? 0).toFixed(2))
                    : Number(v)
                }
                max={isTime ? undefined : isCLS ? undefined : 100}
                color={v == null ? "#9ca3af" : gaugeColor(m.id, v)}
                decimals={isTime ? 1 : isCLS ? 2 : 0}
                suffix={isTime ? "s" : isCLS ? "" : "%"}
                size={120}
              />
              <p className="item-desc" style={{ marginBottom: 4 }}>
                {v == null
                  ? "—"
                  : isTime
                  ? `${v.toFixed(1)}s`
                  : isCLS
                  ? `${v.toFixed(2)}`
                  : `${v}%`}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                {subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== Captura final de Lighthouse ===================
function getFinalScreenshot(apiData: any): string | null {
  const thumb =
    apiData?.raw?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data ||
    apiData?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data ||
    apiData?.raw?.audits?.["final-screenshot"]?.details?.data ||
    apiData?.audits?.["final-screenshot"]?.details?.data ||
    apiData?.raw?.lighthouseResult?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data ||
    apiData?.lighthouseResult?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data ||
    apiData?.raw?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data ||
    apiData?.audits?.["screenshot-thumbnails"]?.details?.items?.slice(-1)?.[0]?.data;

  return typeof thumb === "string" && thumb.startsWith("data:") ? thumb : null;
}

// =================== Mini modal de screenshot ===================
function ScreenshotPreview({ src }: { src: string | null }) {
  const [open, setOpen] = React.useState(false);
  if (!src) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          Vista previa (captura)
        </h3>
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Abrir
        </button>
      </div>

      <img
        src={src}
        alt="Vista previa de la página"
        style={{
          width: 240,
          height: "auto",
          borderRadius: 12,
          display: "block",
          boxShadow: "0 1px 8px rgba(0,0,0,.06)",
        }}
      />

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 16,
              maxWidth: "90vw",
              maxHeight: "90vh",
              boxShadow: "0 10px 30px rgba(0,0,0,.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cerrar
              </button>
            </div>
            <img
              src={src}
              alt="Vista previa ampliada"
              style={{
                maxWidth: "85vw",
                maxHeight: "80vh",
                borderRadius: 12,
                display: "block",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =================== Componente principal ===================
export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id: string | null =
    (params as any)?.id || new URLSearchParams(location.search).get("id");

  // NUEVO: estrategia (Móvil/Ordenador)
  const qs = new URLSearchParams(location.search);
  const initialStrategy =
    (qs.get("strategy") === "desktop" ? "desktop" : "mobile") as "mobile" | "desktop";
  const [strategy, setStrategy] = useState<"mobile" | "desktop">(initialStrategy);

  const [auditData, setAuditData] = useState<AuditEnvelope | null>(null);
  const [err, setErr] = useState<string>("");
  const [activeApi, setActiveApi] = useState<string>("");
  const [processed, setProcessed] = useState<ProcessedData | null>(null);

  // toggles de desgloses
  const [showPerfDetails, setShowPerfDetails] = useState(true);
  const [showAccDetails, setShowAccDetails] = useState(false);
  const [showBPDetails, setShowBPDetails] = useState(false);
  const [showSeoDetails, setShowSeoDetails] = useState(false);

  const contenedorReporteRef = useRef<HTMLDivElement | null>(null);

  // Sincroniza la URL con la estrategia seleccionada (para poder compartir el link)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    p.set("strategy", strategy);
    const newUrl = `${location.pathname}?${p.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [strategy, location.pathname, location.search]);

  useEffect(() => {
    setAuditData(null);
    setErr("");
    setActiveApi("");
    setProcessed(null);
    setShowAccDetails(false);
    setShowBPDetails(false);
    setShowSeoDetails(false);

    if (!id) return;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(id).trim());
    if (!isValidObjectId) {
      setErr("ID inválido");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        // 🔹 Petición por ID con strategy + anticache
        const ts = Date.now();
        const res = await fetch(`/api/audit/${id}?strategy=${strategy}&_=${ts}`, {
          headers: { "Cache-Control": "no-cache" },
        });
        const payload = await safeParseJSON(res);
        if (!res.ok)
          throw new Error(
            payload.error || payload.message || payload._raw || `HTTP ${res.status}`
          );

        // Selecciona API disponible priorizando pagespeed
        const available = Object.keys(payload.audit || {}).filter((k) => {
          const m = (payload.audit?.[k] || {}).metrics || payload.audit?.[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ["pagespeed", "unlighthouse"] as const;
        const apis = ORDER.filter((k) => available.includes(k));
        if (mounted) {
          setActiveApi(apis[0] || "");
          setAuditData(payload);
        }

        // ✅ Verificamos si el LHR coincide con la estrategia solicitada
        try {
          const currentApiKey = apis[0] || "";
          const currentApiData = (payload.audit?.[currentApiKey] || {}) as any;
          const ff = detectFormFactor(currentApiData);

          if (payload.url && ff && ff !== strategy) {
            // Fallback: pedimos por URL+strategy (mismo microservicio, otro endpoint del FormController)
            const forced = await fetchAuditByUrlWithStrategy(payload.url as string, strategy, ts);
            if (forced && mounted) {
              const available2 = Object.keys(forced.audit || {}).filter((k: string) => {
                const m = (forced.audit?.[k] || {}).metrics || forced.audit?.[k] || {};
                return Object.keys(m).length > 0;
              });
              const apis2 = ORDER.filter((k) => available2.includes(k));
              setActiveApi(apis2[0] || currentApiKey);
              setAuditData(forced);
            }
          }
        } catch {}

        // 🔹 Processed con strategy (solo para tendencias)
        if ((payload.url || (auditData as any)?.url)) {
          const urlForProcessed = (payload.url || (auditData as any)?.url) as string;
          const urlSafe = encodeURIComponent(urlForProcessed);
          try {
            const r = await fetch(
              `/api/diagnostics/${urlSafe}/processed?strategy=${strategy}&_=${ts}`,
              { headers: { "Cache-Control": "no-cache" } }
            );
            if (!r.ok) {
              if (r.status === 404 && (payload as any)?._id) {
                const r2 = await fetch(
                  `/api/diagnostics/by-id/${(payload as any)._id}/processed?strategy=${strategy}&_=${ts}`,
                  { headers: { "Cache-Control": "no-cache" } }
                );
                const d2 = await safeParseJSON(r2);
                if (!r2.ok)
                  throw new Error(
                    d2.error || d2.message || d2._raw || `HTTP ${r2.status}`
                  );
                if (mounted) setProcessed(d2);
              } else {
                const errData = await safeParseJSON(r);
                throw new Error(
                  errData.error || errData.message || errData._raw || `HTTP ${r.status}`
                );
              }
            } else {
              const d = await safeParseJSON(r);
              if (mounted) setProcessed(d);
            }
          } catch (e) {
            console.warn("[diagnostics/processed] fetch error:", e);
          }
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || String(e));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, strategy]); // <- cambia todo al alternar móvil/ordenador

  if (!id)
    return (
      <div className="card">
        <p className="error">Falta el ID del diagnóstico.</p>
        <Link to="/" className="back-link">← Volver</Link>
      </div>
    );

  if (err)
    return (
      <div className="card">
        <p className="error">Error: {err}</p>
        <Link to="/" className="back-link">← Volver</Link>
      </div>
    );

  if (!auditData)
    return (
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
        <Link
          to={`/historico?url=${encodeURIComponent(url)}`}
          className="back-link"
          style={{ marginLeft: "1rem" }}
        >
          Ver histórico de esta URL
        </Link>
        <h2 className="diagnostico-title">
          Diagnóstico de <span className="url">{url}</span>
        </h2>
        <p className="no-metrics">No se encontraron métricas para la API seleccionada.</p>
      </div>
    );
  }

  // processed helpers (SOLO para tendencias)
  const pVal = (k: string): number | null => {
    const m: any = (processed as any)?.metrics;
    if (Array.isArray(m)) {
      const v = m.find((x: any) => x?.key === k)?.raw;
      return typeof v === "number" && !Number.isNaN(v) ? v : null;
    } else if (m && typeof m === "object") {
      const raw = (m as any)[k];
      const v =
        typeof raw === "number" ? raw : typeof raw?.raw === "number" ? raw.raw : null;
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

  // Performance — SOLO del payload actual (o categories)
  let performance: number | null = null;
  if (typeof apiData.performance === "number")
    performance = Math.round(apiData.performance);
  else if (typeof metrics.performance === "number")
    performance = Math.round(metrics.performance);
  else {
    const catsLocal = readCategoryScoresFromApi(apiData);
    performance = catsLocal.performance;
  }

  // tiempos base — SIEMPRE del payload actual
  const fcpSec =
    toSeconds(metrics.fcp) ?? getAuditSeconds(apiData, "first-contentful-paint");
  const lcpSec =
    toSeconds(metrics.lcp) ?? getAuditSeconds(apiData, "largest-contentful-paint");
  const siSec =
    toSeconds(metrics.si) ?? getAuditSeconds(apiData, "speed-index");
  const tbtSec =
    toSeconds(metrics.tbt) ?? getAuditSeconds(apiData, "total-blocking-time");
  let ttfbSec =
    toSeconds(metrics.ttfb) ??
    getAuditSeconds(apiData, "server-response-time") ??
    getAuditSeconds(apiData, "time-to-first-byte");

  // CLS
  let clsVal: number | null = null;
  try {
    const audits = pickAudits(apiData);
    const clsAudit =
      audits?.["cumulative-layout-shift"] || audits?.["cumulative-layout-shift-element"] || audits?.["cls"];
    const nv = clsAudit?.numericValue;
    if (typeof nv === "number" && nv >= 0) clsVal = Math.round(nv * 100) / 100;
  } catch {}

  const trendByKey: Record<string, Trend | undefined> = {
    performance: pTrend("performance"),
    fcp: pTrend("fcp"),
    lcp: pTrend("lcp"),
    si: pTrend("si"),
    ttfb: pTrend("ttfb"),
    tbt: pTrend("tbt"),
    cls: pTrend("cls"),
  };

  // Categorías — SOLO del payload actual
  const cats = readCategoryScoresFromApi(apiData);
  const accessibilityPct = cats.accessibility;
  const bestPracticesPct = cats["best-practices"];
  const seoPct = cats.seo;

  // Tarjetas (grid principal)
  const perfCard = {
    id: "performance" as MetricId,
    label: "RENDIMIENTO",
    value: performance,
    desc: `Porcentaje de rendimiento según ${API_LABELS[activeApi]} (${strategy === "mobile" ? "Móvil" : "Ordenador"}).`,
  };
  const categoryCards = [
    {
      id: "accessibility" as MetricId,
      label: "ACCESIBILIDAD",
      value: accessibilityPct,
      desc: "Buenas prácticas de accesibilidad (WAI-ARIA, contraste, labels, etc.)",
    },
    {
      id: "best-practices" as MetricId,
      label: "PRACTICAS RECOMEND.",
      value: bestPracticesPct,
      desc: "Seguridad y prácticas modernas de desarrollo",
    },
    {
      id: "seo" as MetricId,
      label: "SEO",
      value: seoPct,
      desc: "Buenas prácticas básicas de SEO",
    },
  ];

  // Desglose Performance (grid tipo SEO)
  const perfBreakItems = [
    { id: "fcp" as MetricId, label: "FCP", value: fcpSec },
    { id: "lcp" as MetricId, label: "LCP", value: lcpSec },
    { id: "tbt" as MetricId, label: "TBT", value: tbtSec },
    { id: "si"  as MetricId, label: "SI",  value: siSec },
    clsVal != null
      ? ({ id: "cls" as MetricId, label: "CLS", value: clsVal } as const)
      : ({ id: "ttfb" as MetricId, label: "TTFB", value: ttfbSec } as const),
  ];

  // Desgloses por categoría (items)
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
        impactScore: kind === "error" ? 2000 : typeof e.impactScore === "number" ? e.impactScore : 100,
      };
    });

  const planItems = [
    ...opportunities.map((o) => ({
      type: "improvement" as const,
      severity: "info" as const,
      impactScore: 100,
      ...o,
      title: i18nTitle(o.title || o.id),
      recommendation: i18nRich(o.recommendation || ""),
    })),
    ...mapFindingToOpp(detectedErrors, "error"),
    ...mapFindingToOpp(improvements, "improvement"),
  ];

  const renderCard = (item: {
    id: MetricId;
    label: string;
    value: number | null;
    desc: string;
  }) => {
    const isPct = ["performance", "accessibility", "best-practices", "seo"].includes(item.id);
    const clickProps =
      item.id === "performance"
        ? { onClick: () => setShowPerfDetails((v) => !v), style: { cursor: "pointer" } }
        : item.id === "accessibility"
        ? { onClick: () => setShowAccDetails((v) => !v), style: { cursor: "pointer" } }
        : item.id === "best-practices"
        ? { onClick: () => setShowBPDetails((v) => !v), style: { cursor: "pointer" } }
        : item.id === "seo"
        ? { onClick: () => setShowSeoDetails((v) => !v), style: { cursor: "pointer" } }
        : {};

    return (
      <div key={item.id} className="item" {...(clickProps as any)}>
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

        {item.id === "performance" ? (
          <>
            <PerfDial
              score={item.value ?? null}
              segments={[
                { id: "si",  label: "SI",  value: siSec },
                { id: "fcp", label: "FCP", value: fcpSec },
                { id: "lcp", label: "LCP", value: lcpSec },
                { id: "cls", label: "CLS", value: clsVal },
                { id: "tbt", label: "TBT", value: tbtSec },
              ].filter(Boolean) as DialSeg[]}
              size={130}
            />
            <p className="item-desc">
              {item.value == null ? "N/A" : `${item.value}%`} — {item.desc}
            </p>
          </>
        ) : (
          <>
            <div className="w-full min-h-[160px] flex items-center justify-center">
              <CircularGauge
                value={item.value ?? 0}
                max={isPct ? 100 : undefined}
                color={gaugeColor(item.id, item.value)}
                decimals={isPct ? 0 : 1}
                suffix={isPct ? "%" : "s"}
                size={120}
              />
            </div>
            <p className="item-desc">
              {item.value == null
                ? "N/A"
                : isPct
                ? `${item.value}%`
                : `${(item.value as number).toFixed(1)}s`}{" "}
              — {item.desc}
            </p>
          </>
        )}
      </div>
    );
  };

  // =================== UI ===================
  return (
    <div className="card">
      <div ref={contenedorReporteRef}>
        <Link to="/" className="back-link">Nuevo diagnóstico</Link>
        <Link
          to={`/historico?url=${encodeURIComponent(url as string)}`}
          className="back-link"
          style={{ marginLeft: "1rem" }}
        >
          Ver histórico de esta URL
        </Link>

        <h2 className="diagnostico-title">
          Diagnóstico de <span className="url">{url}</span>
        </h2>
        <div className="date">{new Date(fecha as string).toLocaleString()}</div>

        {/* Tabs de estrategia (Móvil | Ordenador) */}
        <div className="tabs" style={{ marginTop: 8 }}>
          <button
            onClick={() => setStrategy("mobile")}
            className={`tab-button${strategy === "mobile" ? " active" : ""}`}
            title="Ejecuta/consulta métricas para móviles"
          >
            📱 Móvil
          </button>
          <button
            onClick={() => setStrategy("desktop")}
            className={`tab-button${strategy === "desktop" ? " active" : ""}`}
            title="Ejecuta/consulta métricas para ordenadores"
            style={{ marginLeft: 8 }}
          >
            🖥️ Ordenador
          </button>
        </div>

        {/* Grid principal: performance + categorías */}
        <div className="diagnostico-grid">
          {renderCard(perfCard)}
          {categoryCards.map(renderCard)}
        </div>

        {/* Desglose Performance — tipo SEO */}
        {showPerfDetails && (
          <>
            <PerfBreakdownGrid items={perfBreakItems as any} />
            <ScreenshotPreview src={getFinalScreenshot(apiData)} />
          </>
        )}

        {/* Desglose Accesibilidad / Best Practices / SEO */}
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

        <ActionPlanPanel
          opportunities={planItems as any}
          performance={performance ?? undefined}
        />
      </div>

      <EmailSendBar
        captureRef={contenedorReporteRef as any}
        url={url as string}
        email={(auditData as any)?.email || ""}
        hideEmailInput={true}
        subject={`Diagnóstico de ${url} (${strategy === "mobile" ? "Móvil" : "Ordenador"})`}
        endpoint="/api/audit/send-diagnostic"
        includePdf={true}
      />
    </div>
  );
}