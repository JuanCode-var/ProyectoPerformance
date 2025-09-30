// ——— src/components/DiagnosticoView.tsx ———
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CircularGauge from "./CircularGauge";
import ActionPlanPanel from "./ActionPlanPanel";
import EmailSendBar from "./EmailPdfBar";
import SecurityScoreWidget from "./SecurityScoreWidget"; // show gauge also in main view
import SecurityDiagnosticoPanel from "./SecurityDiagnosticoPanel";
import { Info, Ban } from "lucide-react";

// shadcn/ui padres
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../shared/ui/tabs";
import { Button } from "../shared/ui/button";
import { useAuth } from '../auth/AuthContext';

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

// Pequeno separador visual reutilizable
function SectionDivider({ label, info }: { label: string; info?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full my-6" role="region" aria-label={label}>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
          <div className="text-[11px] sm:text-xs uppercase tracking-wider text-slate-600 select-none">{label}</div>
          {info && (
            <button
              type="button"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={`info-${label.replace(/\s+/g, "-").toLowerCase()}`}
              title="¿Qué es esto?"
            >
              <Info size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
      </div>
      {info && open && (
        <div
          id={`info-${label.replace(/\s+/g, "-").toLowerCase()}`}
          className="mt-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3"
        >
          {info}
        </div>
      )}
    </div>
  );
}

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

// Función para obtener la etiqueta de la escala visual de performance
function getPerformanceScaleLabel(value: number | null | undefined): { text: string; color: string; bgColor: string } {
  if (value == null) {
    return { text: "N/A", color: "#9ca3af", bgColor: "rgba(156,163,175,0.1)" };
  }
  
  if (value >= 90) {
    return { text: "Bueno", color: "#22c55e", bgColor: "rgba(34,197,94,0.1)" };
  } else if (value >= 50) {
    return { text: "Medio", color: "#f59e0b", bgColor: "rgba(245,158,11,0.1)" };
  } else {
    return { text: "Malo", color: "#ef4444", bgColor: "rgba(239,68,68,0.1)" };
  }
}

// ===== Fondos suaves (tarjetas/desgloses y centro del dial) =====
function softBg(metricId: MetricId, value: number | null | undefined) {
  const isPct = ["performance", "accessibility", "best-practices", "seo"].includes(metricId);
  if (!isPct || value == null) return "#ffffff";
  if (value >= 90) return "rgba(34,197,94,0.08)";
  if (value >= 50) return "rgba(245,158,11,0.08)";
  return "rgba(239,68,68,0.08)";
}
function softTint(metricId: MetricId, value: number | null | undefined) {
  if (value == null) return "rgba(148,163,184,0.10)";
  if (["performance","accessibility","best-practices","seo"].includes(metricId)) {
    if (value >= 90) return "rgba(34,197,94,0.12)";
    if (value >= 50) return "rgba(245,158,11,0.12)";
    return "rgba(239,68,68,0.12)";
  }
  const col = gaugeColor(metricId, value);
  if (col === "#22c55e") return "rgba(34,197,94,0.12)";
  if (col === "#f59e0b") return "rgba(245,158,11,0.12)";
  if (col === "#ef4444") return "rgba(239,68,68,0.12)";
  return "rgba(148,163,184,0.10)";
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
  // 1. Si el microservicio ya lo precalculó (0..100)
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

  // 2. Buscar en múltiples ubicaciones del LHR
  const cats =
    apiData?.raw?.lighthouseResult?.categories ||
    apiData?.raw?.categories ||
    apiData?.lighthouseResult?.categories ||
    apiData?.categories ||
    apiData?.data?.lighthouseResult?.categories ||
    apiData?.result?.lighthouseResult?.categories ||
    null;

  const toPct = (x?: number) => (typeof x === "number" && !Number.isNaN(x) ? Math.round(x * 100) : null);
  
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

  // Primero intentar leer desde metrics si están disponibles
  const metrics = apiData?.metrics;
  if (metrics && typeof metrics[id] === "number") {
    if (/cumulative-layout-shift|^cls$/i.test(id)) {
      return Math.round(metrics[id] * 100) / 100; // CLS
    }
    return toSeconds(metrics[id]);
  }

  // Luego desde el audit numericValue
  if (typeof a.numericValue === "number") {
    if (/cumulative-layout-shift|^cls$/i.test(id)) {
      return Math.round(a.numericValue * 100) / 100; // CLS
    }
    return toSeconds(a.numericValue);
  }

  // Finalmente parsear el displayValue
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

  const errors: any[] = [], improvements: any[] = [];
  for (const a of all) {
    if (a?.scoreDisplayMode === "manual" || a?.scoreDisplayMode === "notApplicable") continue;
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
function CategoryBreakdown({
  label,
  items,
}: {
  label: string;
  items: CatBreakItem[];
}) {
  if (!items.length) return null;
  return (
    <Card className="mt-4 w-full">
      <CardHeader>
        <CardTitle>Desglose de {label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="diagnostico-grid">
          {items.map((it) => {
            const isNull = it.scorePct == null;
            return (
              <div key={it.id} className="item" style={{ background: softBg("performance", it.scorePct) }}>
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
                  suffix="" // sin símbolo
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
      </CardContent>
    </Card>
  );
}

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

  const items = (cat.auditRefs
    .map((ref: any) => {
      const a = auditsObj?.[ref.id] || {};
      const sdm: string | undefined = (a as any).scoreDisplayMode;
      if (sdm === "notApplicable" || sdm === "manual") return null;

      const s =
        typeof (a as any).score === "number"
          ? Math.round((a as any).score * 100)
          : null;

      // savings
      let savingsLabel = "";
      const d = (a as any).details || {};
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
        title: i18nTitle((a as any).title || ref.id),
        scorePct: s,
        displayValue: (a as any).displayValue || "",
        description: i18nRich((a as any).description || ""),
        savingsLabel,
      } as CatBreakItem;
    })
    .filter(Boolean) as CatBreakItem[]);

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

// =================== PerfDial (Rendimiento) ===================
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
  // Lienzo y centro
  const W = size + 28;
  const H = size + 28;
  const cx = W / 2;
  const cy = H / 2 + 2;

  // Geometría
  const strokeW = Math.max(8, Math.round(size * 0.083));
  const segR = size * 0.42;       // radio de los arcos de métricas
  const innerR = size * 0.42;     // ⬅️ más ancho para cubrir el “hueco” interior
  const numFont = Math.round(size * 0.285);

  const trackColor = "#e5e7eb";
  const numberColor = "#111827";

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

  // Layout fijo para etiquetas
  const layout: Record<string, [number, number, number]> = {
    si:  [-110, -70, -90],
    fcp: [ -40,   0, -20],
    lcp: [  20,  60,  40],
    cls: [ 140, 200, 170],
    tbt: [ 210, 250, 230],
  };
  const segs = segments.filter((s) => layout[s.id]);

  // Relleno suave del centro según puntaje
  // Si ya tienes softTint, úsalo; si no, puedes dejar "#ffffff".
  const innerFill = typeof softTint === "function"
    ? softTint("performance", typeof score === "number" ? score : null)
    : "#ffffff";

  return (
    <div style={{ width: "100%", display: "grid", placeItems: "center" }}>
      <svg width={W} height={H}>
        {/* pista circular del dial */}
        <circle cx={cx} cy={cy} r={segR} fill="none" stroke={trackColor} strokeWidth={strokeW} />
        {/* segmentos con colores por métrica */}
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
                style={{
                  fontSize: Math.round(size * 0.083),
                  fill: "#111827",
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
        {/* fondo interno (más ancho para eliminar el espacio en blanco) */}
        <circle cx={cx} cy={cy} r={innerR} fill={innerFill} />
        {/* número central (sin %) */}
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
          {typeof score === "number" ? score : "—"}
        </text>
      </svg>
    </div>
  );
}

// ===== Dial reutilizable para ACC/PRÁCTICAS/SEO (sin tocar tu Gauge) =====
function CategoryDial({
  metricId,
  value,
  size = 120,
  strokeWidth = 12,
}: {
  metricId: MetricId;
  value: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const safe = typeof value === "number" ? value : 0;
  const tint = softTint(metricId, value);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGauge
        value={safe}
        max={100}
        color={gaugeColor(metricId, value)}
        size={size}
        strokeWidth={strokeWidth}
        decimals={0}
        suffix=""
        textColor="#111827"
        trackColor="#e5e7eb"
        showValue={true}
        centerFill={tint}
        centerRadiusPct={0.98}
      />
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

const perfMetricLong: Record<string, React.ReactNode> = {
  fcp: (
    <>
      Indica cuándo se muestra el primer contenido. Umbrales: Bueno &lt; 1.8s, Mejorable 1.8–3.0s, Deficiente &gt; 3.0s.
      Optimiza CSS crítico y reduce bloqueos en el render.
    </>
  ),
  lcp: (
    <>
      Marca cuándo aparece el elemento con contenido más grande (hero, imagen principal, etc.). Umbrales: Bueno &lt; 2.5s,
      Mejorable 2.5–4.0s, Deficiente &gt; 4.0s. Prioriza recursos críticos e imágenes optimizadas.
    </>
  ),
  tbt: (
    <>
      Suma del tiempo en el que el hilo principal estuvo bloqueado durante la carga. Umbrales: Bueno &lt; 0.2s,
      Mejorable 0.2–0.6s, Deficiente &gt; 0.6s. Divide bundles y evita trabajo JS costoso.
    </>
  ),
  si: (
    <>
      Velocidad percibida del render. Umbrales: Bueno &lt; 3.4s, Mejorable 3.4–5.8s, Deficiente &gt; 5.8s.
      Mantén el DOM ligero y usa lazy-load.
    </>
  ),
  ttfb: (
    <>
      Latencia del servidor hasta el primer byte. Umbrales: Bueno &lt; 0.8s, Mejorable 0.8–1.8s, Deficiente &gt; 1.8s.
      Mejora caché, CDN y rendimiento backend.
    </>
  ),
  cls: (
    <>
      Estabilidad visual. Umbrales: Bueno &lt; 0.1, Mejorable 0.1–0.25, Deficiente &gt; 0.25. Reserva espacio para imágenes
      y evita insertar contenido por encima.
    </>
  ),
};

function PerfBreakdownGrid({
  items,
}: {
  items: Array<{ id: MetricId; label: string; value: number | null }>;
}) {
  if (!items.length) return null;
  const [openInfos, setOpenInfos] = React.useState<Record<string, boolean>>({});

  return (
    <Card className="mt-4 w-full">
      <CardHeader>
        <CardTitle>Desglose de Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="diagnostico-grid">
          {items.map((m) => {
            const isTime = m.id !== "performance" && m.id !== "cls";
            const isCLS = m.id === "cls";
            const v = m.value;
            const openInfo = !!openInfos[m.id];
            return (
              <div key={m.id} className="item" style={{ background: softBg(m.id, v) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                  <strong style={{ fontSize: 13 }}>{m.label}</strong>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
                    onClick={(e) => { e.stopPropagation(); setOpenInfos((s) => ({ ...s, [m.id]: !s[m.id] })); }}
                    aria-expanded={openInfo}
                    title="¿Qué es esto?"
                    style={{ marginLeft: 8 }}
                  >
                    <Info size={14} strokeWidth={2.4} />
                  </button>
                </div>
                <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
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
                    suffix={isTime ? "s" : isCLS ? "" : ""}
                    size={120}
                  />
                </div>
                <p className="item-desc" style={{ marginBottom: 0, padding: '0 12px' }}>
                  {v == null
                    ? "—"
                    : isTime
                    ? `${v.toFixed(1)}s`
                    : isCLS
                    ? `${v.toFixed(2)}`
                    : `${v}`}
                </p>
                {openInfo && (
                  <div style={{ padding: '8px 12px' }} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md mt-2">
                    {(perfMetricLong as any)[m.id] || "Información no disponible."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
    <Card className="mt-4 w-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Vista previa (captura)</CardTitle>
        <Button variant="outline" onClick={() => setOpen(true)}>Abrir</Button>
      </CardHeader>
      <CardContent>
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
                <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
              </div>
              <img
                src={src}
                alt="Vista previa ampliada"
                style={{ maxWidth: "85vw", maxHeight: "80vh", borderRadius: 12, display: "block" }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Agregar gráficos circulares para mostrar el impacto de los encabezados
function SecurityImpactDial({ scoreImpact }: { scoreImpact: number }) {
  const size = 120;
  const strokeWidth = 12;
  const safeScore = Math.max(0, Math.min(100, scoreImpact));
  const color = safeScore >= 80 ? "#22c55e" : safeScore >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${safeScore} ${100 - safeScore}`}
        strokeDashoffset="25"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="18"
        fill="#111827"
      >
        {safeScore}%
      </text>
    </svg>
  );
}

// Actualizar el panel de encabezados para incluir gráficos y recomendaciones
function HeadersPanel({ headers }: { headers: Record<string, string> }) {
  return (
    <Card className="mt-4 w-full">
      <CardHeader>
        <CardTitle>Encabezados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(headers).map(([key, value]) => {
            const info = HEADER_INFO[key.toLowerCase()] || {};
            return (
              <div key={key} className="flex flex-col p-2 border rounded-md">
                <span className="font-bold text-gray-700">{info.title || key}</span>
                <span className="text-gray-500">{info.description || "Sin descripción."}</span>
                {info.scoreImpact != null && (
                  <SecurityImpactDial scoreImpact={info.scoreImpact} />
                )}
                {info.recommendation && (
                  <span className="text-blue-600">{info.recommendation}</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Tipos y metadatos para encabezados de seguridad usados en la UI
type HeaderMeta = {
  title?: string;
  description?: string;
  recommendation?: string;
  learnMore?: string;
  why?: string;
  scoreImpact?: number;
};

const HEADER_INFO: Record<string, HeaderMeta> = {
  "content-security-policy": {
    title: "Content-Security-Policy (CSP)",
    description: "Controla qué recursos puede cargar la página para mitigar XSS.",
    recommendation: "Defina una política CSP restrictiva (evite 'unsafe-inline').",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    why: "Sin CSP, aplicaciones son más vulnerables a inyección de scripts.",
  },
  "strict-transport-security": {
    title: "Strict-Transport-Security (HSTS)",
    description: "Forza el uso de HTTPS para evitar ataques de downgrade.",
    recommendation: "Habilite HSTS con un max-age elevado y includeSubDomains si aplica.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    why: "Sin HSTS, usuarios pueden ser forzados a usar HTTP en ciertos ataques.",
  },
  "x-frame-options": {
    title: "X-Frame-Options",
    description: "Evita que la página sea embebida en iframes (clickjacking).",
    recommendation: "Use DENY o SAMEORIGIN según el caso.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    why: "Protege contra ataques de clickjacking.",
  },
  date: {
    title: "Date",
    description: "Encabezado de fecha del servidor.",
    recommendation: "Asegúrese que el reloj del servidor esté sincronizado (NTP).",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Date",
    why: "Diferencias de tiempo pueden afectar caches y firmas.",
  },
};

// =================== Componente principal ===================
export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id: string | null =
    (params as any)?.id || new URLSearchParams(location.search).get("id");

  // Rol del usuario para condicionar UI de histórico
  const { user, loading: authLoading } = useAuth();
  const isCliente = user?.role === 'cliente';


  // NUEVO: estrategia (Móvil/Ordenador)
  const qs = new URLSearchParams(location.search);
  const initialStrategy =
    (qs.get("strategy") === "desktop" ? "desktop" : "mobile") as "mobile" | "desktop";
  const [strategy, setStrategy] = useState<"mobile" | "desktop">(initialStrategy);

  // Vista activa: solo 'performance' o 'security' (inicializada desde ?type=)
  const typeParam = (qs.get("type") || "").toLowerCase();
  const initialDiag = (typeParam === "security" ? "security" : "performance") as
    | "performance"
    | "security";
  const [activeDiag, setActiveDiag] = useState<"performance" | "security">(initialDiag);

  // NEW: mostrar botones de tabs (Performance/Security) solo cuando se pidieron ambas pruebas
  const [bothMode, setBothMode] = useState<boolean>(typeParam === "both");
  // NUEVO estado para modal de resumen combinado
  const [showCombinedSummary, setShowCombinedSummary] = useState(false);

  const [auditData, setAuditData] = useState<AuditEnvelope | null>(null);
  const [err, setErr] = useState<string>("");
  const [activeApi, setActiveApi] = useState<string>("");
  const [processed, setProcessed] = useState<ProcessedData | null>(null);
  
  // Indicador de carga para métricas de performance (cuando cambia la estrategia)
  const [perfLoading, setPerfLoading] = useState(false);

  // toggles de desgloses
  const [showPerfDetails, setShowPerfDetails] = useState(!isCliente);
  const [showAccDetails, setShowAccDetails] = useState(false && !isCliente);
  const [showBPDetails, setShowBPDetails] = useState(false && !isCliente);
  const [showSeoDetails, setShowSeoDetails] = useState(false && !isCliente);
  const [cardInfoOpen, setCardInfoOpen] = useState<Record<string, boolean>>({});

  const contenedorReporteRef = useRef<HTMLDivElement | null>(null);

  // =================== Sincronización y carga inicial ===================
  // Sincroniza estrategia en URL (histórico de strategy)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    p.set("strategy", strategy);
    const newUrl = `${location.pathname}?${p.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [strategy, location.pathname, location.search]);

  // NUEVO: sincroniza type en la URL al cambiar de vista
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    p.set("type", activeDiag);
    const newUrl = `${location.pathname}?${p.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [activeDiag, location.pathname, location.search]);

  // Effect to fetch performance data when in performance view
  useEffect(() => {
    if (activeDiag !== 'performance') return;
    let mounted = true;
    setPerfLoading(true);
    (async () => {
      try {
        const ts = Date.now();
        const res = await safeParseJSON(
          await fetch(`/api/audit/${id}?strategy=${strategy}&_=${ts}`, {
            headers: { "Cache-Control": "no-cache" },
          })
        );
        if ((res as any).error || (res as any).message) throw new Error((res as any).error || (res as any).message);

        const payload = res;
        const available = Object.keys(payload.audit || {}).filter((k) => {
          const m = (payload.audit?.[k] || {}).metrics || payload.audit?.[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ["pagespeed", "unlighthouse"] as const;
        const apis = ORDER.filter((k) => available.includes(k));
        if (mounted) {
          setActiveApi(apis[0] || "");
          setAuditData(payload);
          // Activar modo "ambos" si detectamos datos de seguridad y de performance
          setBothMode((prev) => prev || (!!(payload as any)?.audit?.security && apis.length > 0));
          // Si no hay datos de rendimiento pero sí de seguridad, cambia automáticamente a la pestaña de Seguridad
          if (!apis.length && (payload as any)?.audit?.security) {
            setActiveDiag('security');
          }
        }

        try {
          const currentApiKey = apis[0] || "";
          const currentApiData = (payload.audit?.[currentApiKey] || {}) as any;
          const ff = detectFormFactor(currentApiData);
          if (payload.url && ff && ff !== strategy) {
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

        if ((payload.url || (auditData as any)?.url)) {
          const urlForProcessed = (payload.url || (auditData as any)?.url) as string;
          const urlSafe = encodeURIComponent(urlForProcessed);
          try {
            const r = await fetch(
              `/api/diagnostics/${urlSafe}/processed?strategy=${strategy}&_=${ts}`,
              { headers: { "Cache-Control": "no-cache" } }
            );
            if (r.ok) {
              const d = await safeParseJSON(r);
              if (mounted) setProcessed(d);
            }
          } catch {}
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setPerfLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [id, strategy, activeDiag]);

  // NEW: When landing directly on Security view, fetch the envelope to get URL and persisted security data
  useEffect(() => {
    if (activeDiag !== 'security') return;
    if (auditData?.url) return; // already have it
    let mounted = true;
    (async () => {
      try {
        const ts = Date.now();
        const res = await safeParseJSON(
          await fetch(`/api/audit/${id}?strategy=${strategy}&_=${ts}`, {
            headers: { "Cache-Control": "no-cache" },
          })
        );
        if (!(res as any).error && mounted) {
          setAuditData(res);
          // Si detectamos que existen datos de performance y seguridad, habilitar los tabs
          const available = Object.keys((res as any)?.audit || {}).filter((k: string) => {
            const m = ((res as any)?.audit?.[k] || {}).metrics || (res as any)?.audit?.[k] || {};
            return Object.keys(m).length > 0;
          });
          const ORDER = ["pagespeed", "unlighthouse"] as const;
          const hasPerf = ORDER.some((k) => available.includes(k));
          setBothMode((prev) => prev || (hasPerf && !!(res as any)?.audit?.security));
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || String(e));
      }
    })();
    return () => { mounted = false; };
  }, [id, strategy, activeDiag]);

  // Cargar historial de seguridad si tenemos URL
  const [securityHistory, setSecurityHistory] = useState<Array<{ fecha: string; score: number | null }>>([]);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const u = (auditData as any)?.url;
        if (!u) return;
        const ts = Date.now();
        const r = await fetch(`/api/security/history?url=${encodeURIComponent(u)}&_=${ts}`, { headers: { 'Cache-Control': 'no-cache' } });
        if (!r.ok) return;
        const data = await safeParseJSON(r);
        if (mounted && Array.isArray(data)) {
          setSecurityHistory(data.map((d: any) => ({ fecha: d.fecha, score: typeof d.score === 'number' ? d.score : null })));
        }
      } catch {}
    };
    run();
    return () => { mounted = false; };
  }, [auditData?.url]);

  // Limpia datos al cambiar vista activa para evitar información cruzada
  useEffect(() => {
    // Mantenemos auditData para conservar la URL al cambiar a Seguridad
    // Esto permite que el SecurityDiagnosticoPanel auto-ejecute con la URL.
    if (activeDiag === 'performance') {
      // No-op
    }
    if (activeDiag === 'security') {
      // No limpiar auditData ni err
    }
  }, [activeDiag]);

  if (!id)
    return (
      <Card>
        <CardContent className="p-6">
          <p className="error">Falta el ID del diagnóstico.</p>
          <Link to="/" className="back-link">← Volver</Link>
        </CardContent>
      </Card>
    );

  if (err)
    return (
      <Card>
        <CardContent className="p-6">
          <p className="error">Error: {err}</p>
          <Link to="/" className="back-link">← Volver</Link>
        </CardContent>
      </Card>
    );

  if (!auditData && activeDiag === 'performance')
    return (
      <Card>
        <CardContent className="p-6">
          <div className="spinner" />
          <p>Cargando diagnóstico…</p>
        </CardContent>
      </Card>
    );

  // ======== Datos ========
  const { url, fecha, audit = {} } = ((auditData as any) || {}) as any;
  const apiData = (audit as Record<string, any>)[activeApi] || {};
  const metrics = apiData.metrics || apiData;

  // Mostrar mensaje de "sin métricas" solo para la vista de Performance
  if (activeDiag === 'performance' && (!activeApi || Object.keys(metrics).length === 0)) {
    return (
      <Card>
        <CardContent className="p-6">
          <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
          {url && (
            isCliente ? (
              <button
                type="button"
                className="back-link cursor-not-allowed opacity-60 inline-flex items-center gap-1 ml-4"
                title="Acceso restringido para clientes"
                aria-disabled
              >
                <Ban size={16} /> Histórico no disponible
              </button>
            ) : (
              <Link
                to={`/historico?url=${encodeURIComponent(url as string)}`}
                className="back-link ml-4"
              >
                Ver histórico de esta URL
              </Link>
            )
          )}
          <h2 className="diagnostico-title">
            Diagnóstico de: <span className="url">{url}</span>
          </h2>
          <p className="no-metrics">No se encontraron métricas para la API seleccionada.</p>
          {(audit as any)?.security && (
            <div style={{ marginTop: 12 }}>
              <Button variant="outline" onClick={() => setActiveDiag('security')}>Ver diagnóstico de Seguridad</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

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
    desc: `Puntaje de rendimiento según ${API_LABELS[activeApi]} (${strategy === "mobile" ? "Móvil" : "Ordenador"}).`,
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

  // ===== Items para el desglose de performance (FCP, LCP, TBT, SI, TTFB, CLS)
  const perfBreakItems: Array<{ id: MetricId; label: string; value: number | null }> = [
    { id: "fcp",  label: "FCP",  value: fcpSec },
    { id: "lcp",  label: "LCP",  value: lcpSec },
    { id: "tbt",  label: "TBT",  value: tbtSec },
    { id: "si",   label: "SI",   value: siSec },
    { id: "ttfb", label: "TTFB", value: ttfbSec },
    { id: "cls",  label: "CLS",  value: clsVal },
  ];

  // ===== Desgloses por categoría (Accesibilidad / Prácticas / SEO)
  const accBreak = getCategoryBreakdown("accessibility", apiData);
  const bpBreak  = getCategoryBreakdown("best-practices", apiData);
  const seoBreak = getCategoryBreakdown("seo", apiData);

  // ===== Plan de acción (combina errores/mejoras y oportunidades)
  const findings = buildFindings(apiData, processed);
  const opportunities = buildOpportunities(apiData, processed);
  const planItems = [
    // Mapear errores/mejoras de findings a formato del panel
    ...findings.errors.map((e: any) => ({
      id: e.id,
      title: e.title,
      recommendation: e.description,
      type: "error" as const,
      severity: "critical" as const,
      impactScore: 2200, // ponderación alta por defecto para errores
    })),
    ...findings.improvements.map((e: any) => ({
      id: e.id,
      title: e.title,
      recommendation: e.description,
      type: "improvement" as const,
      severity: "info" as const,
      impactScore: 900,
    })),
    // Y oportunidades calculadas (ya incluyen savings/impacto)
    ...opportunities,
  ];

  const cardInfoText: Record<string, React.ReactNode> = {
    performance: (
      <>
        Índice global (0–100) de Lighthouse que resume el estado de carga percibida de la página. Se compone principalmente
        de FCP, LCP, TBT, SI y estabilidad visual (CLS). El puntaje varía según el modo de prueba (Móvil/Ordenador).
      </>
    ),
    accessibility: (
      <>
        Evalúa si la UI es usable por la mayor cantidad de personas posible: semántica correcta, roles y labels
        accesibles, contraste de color y navegación por teclado.
      </>
    ),
    "best-practices": (
      <>
        Conjunto de verificaciones sobre seguridad del front-end y uso de APIs modernas (HTTPS, uso seguro de JS,
        imágenes con dimensiones, etc.).
      </>
    ),
    seo: (
      <>
        Señales técnicas básicas para descubrimiento en buscadores: metadatos HTML, enlaces, etiquetas canónicas,
        accesibilidad técnica y contenido indexable.
      </>
    ),
  };

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
    const infoOpen = !!cardInfoOpen[item.id];
    return (
      <div key={item.id} className="item" style={{ background: "#ffffff" }} {...(clickProps as any)}>
        <h3 className="item-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {item.label}
          {trendByKey[item.id] && (
            <span style={{ fontSize: 12, color: trendColor(trendByKey[item.id]) }}>
              {trendSymbol(trendByKey[item.id])}
            </span>
          )}
          {/* NEW: keep info icon on all main cards */}
          <button
            type="button"
            className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
            onClick={(e) => {
              e.stopPropagation();
              setCardInfoOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
            }}
            aria-expanded={infoOpen}
            aria-controls={`card-info-${item.id}`}
            title="¿Qué es esto?"
          >
            <Info size={14} strokeWidth={2.4} />
          </button>
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
            <div className="w-full min-h-[160px] flex items-center justify-center">
              <CategoryDial metricId={item.id} value={item.value} size={110} strokeWidth={10} />
            </div>
            {/* Escala visual completa de performance */}
            <div className="flex flex-col items-center gap-3 mb-2">
              {/* Escala completa siempre visible */}
              <div className="flex flex-wrap justify-center gap-1 text-xs">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                  item.value != null && item.value < 50 
                    ? 'bg-red-50 border-red-200 text-red-700 font-medium' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span>Malo (0-49)</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                  item.value != null && item.value >= 50 && item.value < 90 
                    ? 'bg-orange-50 border-orange-200 text-orange-700 font-medium' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span>Medio (50-89)</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                  item.value != null && item.value >= 90 
                    ? 'bg-green-50 border-green-200 text-green-700 font-medium' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Bueno (90-100)</span>
                </div>
              </div>
              
              {/* Texto explicativo pequeño */}
              <p className="text-xs text-center text-slate-500 max-w-[240px] leading-tight">
                El estado actual se resalta según el puntaje obtenido
              </p>
            </div>
            <p className="item-desc">
              {item.value == null ? "N/A" : `${item.value}`} — {item.desc}
            </p>
          </>
        ) : (
          <>
            <div className="w-full min-h-[160px] flex items-center justify-center">
              <CategoryDial metricId={item.id} value={item.value} size={110} strokeWidth={10} />
            </div>
            {/* Escala visual completa para otras métricas */}
            <div className="flex flex-col items-center gap-3 mb-2">
              {/* Escala completa siempre visible */}
              <div className="flex flex-wrap justify-center gap-1 text-xs">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                  item.value != null && item.value < 50 
                    ? 'bg-red-50 border-red-200 text-red-700 font-medium' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span>Malo (0-49)</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                  item.value != null && item.value >= 50 && item.value < 90 
                    ? 'bg-orange-50 border-orange-200 text-orange-700 font-medium' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span>Medio (50-89)</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                  item.value != null && item.value >= 90 
                    ? 'bg-green-50 border-green-200 text-green-700 font-medium' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Bueno (90-100)</span>
                </div>
              </div>
              
              {/* Texto explicativo pequeño */}
              <p className="text-xs text-center text-slate-500 max-w-[240px] leading-tight">
                El estado actual se resalta según el puntaje obtenido
              </p>
            </div>
            <p className="item-desc">
              {item.value == null
                ? "N/A"
                : isPct
                ? `${item.value}`
                : `${(item.value as number).toFixed(1)}s`} {" "}
              — {item.desc}
            </p>
          </>
        )}
        {infoOpen && (
          <div className="mt-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-2" role="note">
            {cardInfoText[item.id] || item.desc}
          </div>
        )}
      </div>
    );
  };

  // =================== UI ===================
  // Rol del usuario para condicionar UI de histórico
  // const { user } = useAuth(); // moved to top
  // const isCliente = user?.role === 'cliente';

  return (
    <Card>
      <CardContent>
        <div ref={contenedorReporteRef} className="w-full" style={{ overflowX: "hidden" }}>
          <div className="flex items-center gap-4 mb-2">
            <Link to="/" className="back-link">Nuevo diagnóstico</Link>
            {!!url && activeDiag === 'performance' && (
              isCliente ? (
                <button
                  type="button"
                  className="back-link cursor-not-allowed opacity-60 inline-flex items-center gap-1 ml-4"
                  title="Acceso restringido para clientes"
                  aria-disabled
                >
                  <Ban size={16} /> Histórico no disponible
                </button>
              ) : (
                <Link
                  to={`/historico?url=${encodeURIComponent(url as string)}`}
                  className="back-link ml-4"
                >
                  Ver histórico de esta URL
                </Link>
              )
            )}
            {!!url && activeDiag === 'security' && (
              isCliente ? (
                <button
                  type="button"
                  className="back-link cursor-not-allowed opacity-60 inline-flex items-center gap-1"
                  title="Acceso restringido para clientes"
                  aria-disabled
                >
                  <Ban size={16} /> Histórico no disponible
                </button>
              ) : (
                <Link
                  to={`/security-history?url=${encodeURIComponent(url as string)}`}
                  className="back-link"
                >
                  Ver histórico de esta URL
                </Link>
              )
            )}
          </div>

          {/* UI Buttons for diagnostics (centrado arriba del título) */}
          {bothMode && (
          <div className="diagnostico-btn-group justify-center text-center">
            <Button 
              style={{
                background: activeDiag === 'performance' ? 'linear-gradient(to right, #3b82f6, #2563eb)' : '#ffffff',
                color: activeDiag === 'performance' ? '#ffffff' : '#2563eb',
                border: 'none',
                transition: 'all 0.3s ease',
                padding: '10px 20px',
                borderRadius: '6px',
                fontWeight: 500
              }}
              onClick={() => {
                setActiveDiag('performance');
              }} 
              variant="outline"
            >
              Ver diagnóstico Performance
            </Button>
            <Button 
              style={{
                background: activeDiag === 'security' ? 'linear-gradient(to right, #3b82f6, #2563eb)' : '#ffffff',
                color: activeDiag === 'security' ? '#ffffff' : '#2563eb',
                border: 'none',
                transition: 'all 0.3s ease',
                padding: '10px 20px',
                borderRadius: '6px',
                fontWeight: 500
              }}
              onClick={() => setActiveDiag('security')} 
              variant="outline"
            >
                                                     Ver diagnóstico de Seguridad
            </Button>
          </div>)
          }

          {/* Botón de resumen combinado centrado */}
          {bothMode && (audit as any)?.security && activeApi && (
            <div className="flex w-full justify-center mb-4">
              <Button
                style={{
                  background: showCombinedSummary ? 'linear-gradient(to right, #3b82f6, #2563eb)' : '#ffffff',
                  color: showCombinedSummary ? '#ffffff' : '#2563eb',
                  border: 'none',
                  transition: 'all 0.3s ease',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontWeight: 500
                }}
                onClick={() => setShowCombinedSummary(true)}
                variant="outline"
                disabled={perfLoading}
              >
                Resumen combinado
              </Button>
            </div>
          )}

          <h2 className="diagnostico-title">
            Diagnóstico de: <span className="url">{url}</span>
          </h2>

          {/* Show strategy tabs only for performance */}
          {!isCliente && (
          <div className="flex flex-col gap-4">
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 mb-4 px-2">
              <Tabs value={strategy} onValueChange={(v)=>{ setPerfLoading(true); setStrategy((v as 'mobile'|'desktop')); }}>
                <TabsList className="bg-[#e9eefb] rounded-xl p-1 w-full sm:w-auto">
                  <TabsTrigger
                    value="mobile"
                    className="flex-1 sm:w-32 lg:w-40 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs sm:text-sm"
                    disabled={perfLoading}
                  >
                    <span role="img" aria-label="mobile" className="mr-1 sm:mr-2">📱</span>
                    <span className="hidden sm:inline">Móvil</span>
                    <span className="sm:hidden">Móv</span>
                    {perfLoading && strategy === 'mobile' && (
                      <span className="ml-1 sm:ml-2 text-xs opacity-80 hidden sm:inline">Cargando…</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="desktop"
                    className="flex-1 sm:w-32 lg:w-40 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs sm:text-sm"
                    disabled={perfLoading}
                  >
                    <span role="img" aria-label="desktop" className="mr-1 sm:mr-2">🖥</span>
                    <span className="hidden sm:inline">Ordenador</span>
                    <span className="sm:hidden">PC</span>
                    {perfLoading && strategy === 'desktop' && (
                      <span className="ml-1 sm:ml-2 text-xs opacity-80 hidden sm:inline">Cargando…</span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Info icon para explicar las estrategias de testing */}
              <div 
                className="relative group cursor-help flex-shrink-0"
                title="Información sobre las estrategias de testing"
              >
                <Info 
                  size={18} 
                  className="text-blue-600 hover:text-blue-700 transition-colors" 
                />
                <div className="strategy-tooltip absolute left-1/2 -translate-x-1/2 top-full mt-2 p-4 bg-slate-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[999]">
                  <div className="font-semibold mb-2 text-sm">🔍 Estrategias de Testing - Google PageSpeed API</div>
                  <div className="space-y-2 text-xs leading-relaxed">
                    <div>
                      <strong className="text-blue-300">📱 Móvil:</strong>
                      <br />• Simula un Moto G4 con conexión 3G lenta
                      <br />• Viewport: 412x823px, densidad 2.625x
                      <br />• Throttling: CPU 4x más lento, red 3G (1.6Mbps down, 750Kbps up)
                      <br />• Métricas más estrictas para reflejar dispositivos reales
                    </div>
                    <div>
                      <strong className="text-orange-300">🖥 Ordenador:</strong>
                      <br />• Simula un desktop con conexión rápida
                      <br />• Viewport: 1350x940px
                      <br />• Sin throttling de CPU, conexión de escritorio típica
                      <br />• Umbrales más permisivos para LCP, FCP, etc.
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <strong className="text-green-300">💡 Tip:</strong> Google recomienda priorizar la experiencia móvil ya que representa ~60% del tráfico web.
                    </div>
                  </div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-900"></div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Indicador de carga bajo las tabs cuando se están obteniendo métricas */}
          {activeDiag === 'performance' && perfLoading && (
            <div className="w-full flex justify-center my-3">
              <div className="flex items-center gap-3 text-slate-600">
                <div className="spinner" />
                <span>Cargando métricas {strategy === 'desktop' ? 'de Ordenador' : 'Móvil'}…</span>
              </div>
            </div>
          )}

          {/* Security content */}
          {activeDiag === 'security' && url && (
            <SecurityDiagnosticoPanel
               url={url as string}
               initialResult={(audit as any)?.security}
               autoRunOnMount={!((audit as any)?.security)}
            />
          )}

          {/* Main performance content */}
          {activeDiag === 'performance' && (
            <div className="relative">
              {perfLoading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="spinner" />
                    <span>Actualizando métricas…</span>
                  </div>
                </div>
              )}
              <div className={perfLoading ? 'opacity-60 transition-opacity' : ''}>
                {/* Título de Diagnóstico de Performance */}
                <div className="mb-6">
                  <h3 className="flex items-center gap-3 text-slate-700 text-lg font-medium mb-2">
                    ⚡ Diagnóstico de Performance
                  </h3>
                  <p className="text-xs text-slate-500">
                    Análisis completo del rendimiento web mediante {API_LABELS[activeApi]} en modo {strategy === "mobile" ? "Móvil" : "Ordenador"}.
                  </p>
                </div>

                {/* Fundamentos / confiabilidad del diagnóstico */}
                <SectionDivider
                  label="Acerca del análisis"
                  info={
                    <>
                      <div className="space-y-3 text-xs leading-relaxed">
                        <p><strong>Fuente de datos:</strong> Ejecución de Google Lighthouse (LHR) vía microservicio, extrayendo categories, audits y métricas (FCP, LCP, TBT, CLS, TTFB, SI). No se alteran los cálculos originales; sólo se normalizan (0–100) y se clasifican.</p>
                        <p><strong>Flujo:</strong> Petición → ejecución/recuperación Lighthouse → parseo de categories → extracción de métricas y hallazgos → clasificación (errores, mejoras, oportunidades) → render.</p>
                        <p><strong>Variabilidad:</strong> Carga del servidor origen, latencia/red, recursos de terceros, caché fría/caliente, estrategia (Móvil vs Ordenador), throttling de Lighthouse, versión de Lighthouse, geolocalización/CDN, picos de CPU (JS largo / GC).</p>
                        <p><strong>Confiabilidad:</strong> Metodología abierta Lighthouse; umbrales alineados con Web Vitals; trazabilidad (URL, timestamp, estrategia); reproducible con lighthouse CLI usando parámetros equivalentes.</p>
                        <p><strong>Interpretación rápida:</strong> Performance ≥90 Bueno, 50–89 Medio, &lt;50 Mejorar. LCP &lt;2.5s, TBT &lt;0.2s, CLS &lt;0.1, TTFB &lt;0.8s.</p>
                        <p><strong>Buenas prácticas para comparar:</strong> Ejecutar 3–5 corridas y usar mediana; no mezclar estrategias; evitar ventanas de despliegue/picos; fijar versión de Lighthouse si se busca consistencia histórica.</p>
                        <p><strong>Limitaciones:</strong> Emulación ≠ condiciones reales completas; variación geográfica y de usuarios finales; cambios futuros de versión pueden ajustar pesos de métricas.</p>
                      </div>
                    </>
                  }
                />

                <SectionDivider
                  label="Resumen"
                  info={
                    <>
                      Vista general del estado de rendimiento. El puntaje (0–100) se calcula con base en métricas como FCP, LCP,
                      TBT, SI y estabilidad visual (CLS). Las tarjetas de Accesibilidad, Prácticas recomendadas y SEO reflejan aspectos
                      técnicos complementarios. Puedes pulsar cada tarjeta para ver su desglose.
                    </>
                  }
                />
                {/* Grid principal: performance + categorías */}
                <div className="diagnostico-grid w-full">
                  {renderCard(perfCard)}
                  {categoryCards.map(renderCard)}
                </div>

                {/* Desglozes y captura */}
                {(showPerfDetails || showAccDetails || showBPDetails || showSeoDetails) && !isCliente && (
                  <SectionDivider
                    label="Desgloses y capturas"
                    info={
                      <>
                        Métricas de rendimiento clave y la captura final de la página durante la auditoría. Los colores indican
                        si una métrica está en buen estado, es mejorable o es deficiente según los umbrales recomendados de Lighthouse.
                      </>
                    }
                  />
                )}

                {/* Desglose Performance — tipo SEO */}
                {showPerfDetails && !isCliente && (
                  <>
                    <PerfBreakdownGrid items={perfBreakItems as any} />
                    <ScreenshotPreview src={getFinalScreenshot(apiData)} />
                  </>
                )}

                {/* Desglose Accesibilidad / Best Practices / SEO */}
                {showAccDetails && !isCliente && (
                  <CategoryBreakdown
                    label="Accesibilidad"
                    items={accBreak.length ? accBreak : translateList((apiData as any)?.accessibility?.items)}
                  />
                )}

                {showBPDetails && !isCliente && (
                  <CategoryBreakdown
                    label="Prácticas recomendadas"
                    items={bpBreak.length ? bpBreak : translateList((apiData as any)?.["best-practices"]?.items)}
                  />
                )}

                {showSeoDetails && !isCliente && (
                  <CategoryBreakdown
                    label="SEO"
                    items={seoBreak.length ? seoBreak : translateList((apiData as any)?.seo?.items)}
                  />
                )}

                 {/* Aviso de acceso limitado para clientes (oculta desgloses) */}
                 {isCliente && (
                   <div className="rounded-lg border p-4 bg-amber-50 border-amber-200 text-amber-800 mb-6 mt-4">
                     <div className="flex items-start gap-3">
                       <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                         <Ban size={16} />
                       </div>
                       <div className="text-sm">
                         <div className="font-semibold mb-1">Acceso limitado – Desgloses de rendimiento</div>
                         <p>Los desgloses detallados de métricas (FCP, LCP, TBT, SI, TTFB, CLS), capturas y listas completas de hallazgos se reservan para roles internos. Contacte al equipo para ampliar permisos.</p>
                       </div>
                     </div>
                      </div>
                    )}

                <SectionDivider
                  label="Plan de acción"
                  info={
                    <>
                      Recomendaciones priorizadas para mejorar el rendimiento basadas en oportunidades y fallos detectados por Lighthouse
                      (tamaño de recursos, compresión, caché, carga diferida, etc.).
                    </>
                  }
                />

                {/* Aviso de acceso limitado para clientes (oculta desgloses) */}
                {isCliente && (
                  <div className="rounded-lg border p-4 bg-amber-50 border-amber-200 text-amber-800 mb-6 mt-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Ban size={16} />
                      </div>
                      <div className="text-sm">
                        <div className="font-semibold mb-1">Acceso limitado – Plan de acción</div>
                        <p>EL plan de acción detallado de riesgos y mejoras recomendadas (Riesgos y recomendaciones para mejorar el rendimiento del aplicativo), capturas y listas completas de hallazgos se reservan para roles internos. Contacte al equipo para ampliar permisos.</p>
                      </div>
                    </div>
                  </div>
                )}
                <ActionPlanPanel
                  opportunities={planItems}
                  performance={performance}
                />

                <SectionDivider
                  label="Compartir / Exportar"
                  info={
                    <>
                      Envía por correo y exporta a PDF este diagnóstico con métricas, desgloses y plan de acción para compartir con tu equipo.
                    </>
                  }
                />
                <EmailSendBar
                  captureRef={contenedorReporteRef as any}
                  url={url as string}
                  email={(auditData as any)?.email || ""}
                  hideEmailInput={true}
                  subject={`Diagnóstico de ${url} (${strategy === "mobile" ? "Móvil" : "Ordenador"})`}
                  endpoint="/api/audit/send-diagnostic"
                  includePdf={true}
                  captureWidthPx={1200}
                />
              </div>
            </div>
          )}
          
        </div>
      </CardContent>
      {/* Modal de resumen combinado */}
      {showCombinedSummary && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Resumen combinado de Performance y Seguridad"
          onClick={() => setShowCombinedSummary(false)}
        >
          <div
            style={{
              background: '#ffffff', borderRadius: 20, maxWidth: '1200px', width: '100%',
              maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.25)',
              padding: '32px 32px 40px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-10">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 m-0">Resumen combinado</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setShowCombinedSummary(false)}>Cerrar</Button>
                </div>
              </div>

              {/* NUEVO LAYOUT: Performance (columna fija) + Seguridad (columna expandida) */}
              <div className="flex flex-col lg:flex-row gap-10 items-start">
                {/* Bloque Performance */}
                <div className="w-full lg:max-w-sm border rounded-2xl p-5 flex flex-col gap-4 bg-white/90 backdrop-blur-sm shadow-sm">
                  <h4 className="text-base font-semibold text-slate-800 m-0 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />Performance
                  </h4>
                  {activeApi && performance != null ? (
                    <div className="flex flex-col items-center gap-6">
                      <CategoryDial metricId="performance" value={performance} size={140} strokeWidth={14} />
                      
                      {/* Escala visual completa de performance - versión modal */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex flex-wrap justify-center gap-1 text-xs">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                            performance < 50 
                              ? 'bg-red-50 border-red-200 text-red-700 font-medium' 
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span>Malo (0-49)</span>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                            performance >= 50 && performance < 90 
                              ? 'bg-orange-50 border-orange-200 text-orange-700 font-medium' 
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                            <span>Medio (50-89)</span>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                            performance >= 90 
                              ? 'bg-green-50 border-green-200 text-green-700 font-medium' 
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>Bueno (90-100)</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 w-full text-[11px] text-slate-700">
                        {perfBreakItems.map(m => (
                          <div key={m.id} className="flex flex-col items-center p-2 rounded-lg bg-slate-50 border">
                            <span className="font-semibold tracking-wide">{m.label}</span>
                            <span className="text-slate-900 mt-1 text-xs">
                              {m.value == null ? '—' : (m.id === 'cls' ? m.value?.toFixed(2) : m.id === 'fcp' || m.id === 'lcp' || m.id === 'tbt' || m.id === 'si' || m.id === 'ttfb' ? `${m.value?.toFixed(1)}s` : m.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-center text-slate-600 max-w-[260px] m-0">
                        Puntaje y métricas clave ({strategy === 'mobile' ? 'Móvil' : 'Ordenador'}).
                      </p>
                      {/* Logo Choucair debajo de métricas de performance */}
                      <img
                        src={typeof window !== 'undefined' ? '/LogoChoucair.png' : 'LogoChoucair.png'}
                        alt="Choucair"
                        className="mt-4 w-40 opacity-90 hover:opacity-100 transition-opacity select-none"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No hay métricas de performance.</p>
                  )}
                </div>

                {/* Bloque Seguridad ocupa el resto */}
                <div className="flex-1 w-full border rounded-2xl p-6 bg-white/90 backdrop-blur-sm shadow-sm overflow-visible">
                  <h4 className="text-base font-semibold text-slate-800 m-0 flex items-center gap-2 mb-4">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />Seguridad
                  </h4>
                  {(audit as any)?.security ? (
                    <div className="flex flex-col gap-6">
                      {/* Widget a ancho completo */}
                      <div className="w-full">
                        <SecurityScoreWidget
                          score={(audit as any)?.security?.score}
                          grade={(audit as any)?.security?.grade}
                          history={securityHistory}
                          topFindings={((audit as any)?.security?.findings || []).filter((f: any) => f?.severity === 'critical' || f?.severity === 'warning').slice(0, 3)}
                        />
                      </div>
                      {/* Quick facts en una rejilla más amplia */}
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 text-xs text-slate-700">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: (audit as any)?.security?.https ? '#16a34a' : '#ef4444' }} />
                          <span className="font-medium">HTTPS: {(audit as any)?.security?.https ? 'Sí' : 'No'}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: (audit as any)?.security?.httpsEnforced ? '#16a34a' : '#f59e0b' }} />
                          <span className="font-medium">Redir. HTTPS: {(audit as any)?.security?.httpsEnforced ? 'Sí' : 'No claro'}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: (audit as any)?.security?.checks?.['hsts']?.ok ? '#16a34a' : '#ef4444' }} />
                          <span className="font-medium">HSTS: {(audit as any)?.security?.checks?.['hsts']?.ok ? 'OK' : 'Falta'}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border">
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
                          <span className="font-medium">Entorno: {(audit as any)?.security?.environment?.kind || '—'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No hay datos de seguridad disponibles.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}