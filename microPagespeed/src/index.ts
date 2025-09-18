// Endpoint POST /audit para compatibilidad con gateway
// (debe ir después de la declaración de 'app')

// ...existing code...

// Inserta el endpoint justo después de la declaración de 'app'


// Carga variables de entorno desde .env (asegura PSI_API_KEY disponible)
import dotenv from "dotenv";
dotenv.config();

// src/index.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import type { Request, Response } from "express";

// ⚙️ Tu micro de PageSpeed / Lighthouse
import { runPageSpeed } from "./pagespeed.service.js";

// 🗣️ i18n ES (asegúrate de tener el archivo en src/lib/lh-i18n-es.ts)
import { tTitle, tRich } from "./lib/lh-i18n-es.js";

// ───────────────────────────────────────────────────────────────────────────────
// Utilidades
// ───────────────────────────────────────────────────────────────────────────────

function pickAudits(anyData: any): Record<string, any> {
  // PSI remoto
  if (anyData?.raw?.lighthouseResult?.audits) return anyData.raw.lighthouseResult.audits;
  // Lighthouse local (guardamos el LHR en raw)
  if (anyData?.raw?.audits) return anyData.raw.audits;
  // También por si el caller trae el LHR plano
  if (anyData?.audits) return anyData.audits;
  return {};
}

function toSeconds(ms?: number | null): number | null {
  if (typeof ms !== "number" || Number.isNaN(ms)) return null;
  return Math.round((ms / 1000) * 10) / 10;
}

function humanBytes(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

function savingsLabelFromAudit(a: any): string {
  const d = a?.details || {};
  const ms = typeof d.overallSavingsMs === "number" ? d.overallSavingsMs : undefined;
  const bytes = typeof d.overallSavingsBytes === "number" ? d.overallSavingsBytes : undefined;

  if (typeof ms === "number" && ms > 0) {
    if (ms >= 100) return `${Math.round((ms / 1000) * 10) / 10}s`;
    return `${Math.round(ms)}ms`;
  }
  if (typeof bytes === "number" && bytes > 0) {
    return humanBytes(bytes);
  }
  if (typeof a?.displayValue === "string" && a.displayValue.trim()) {
    return a.displayValue;
  }
  return "";
}

function getFinalScreenshotBase64(payload: any): string | null {
  const a =
    payload?.raw?.lighthouseResult?.audits?.["final-screenshot"] ||
    payload?.raw?.audits?.["final-screenshot"] ||
    payload?.audits?.["final-screenshot"];
  const data = a?.details?.data;
  return typeof data === "string" && data.startsWith("data:") ? data : null;
}

// Construye “processed” con traducción opcional (lang === "es")
function buildProcessedFromPayload(payload: any, lang: string = "es") {
  const audits = pickAudits(payload);

  // Métricas base (segundos). TBT queda en ms para mayor fidelidad.
  const fcpSec = toSeconds(audits?.["first-contentful-paint"]?.numericValue ?? null);
  const lcpSec = toSeconds(audits?.["largest-contentful-paint"]?.numericValue ?? null);
  const siSec = toSeconds(audits?.["speed-index"]?.numericValue ?? null);
  const tbtMs =
    typeof audits?.["total-blocking-time"]?.numericValue === "number"
      ? Math.max(0, Math.round(audits["total-blocking-time"].numericValue))
      : null;

  // TTFB: server-response-time → sec
  let ttfbSec = toSeconds(audits?.["server-response-time"]?.numericValue ?? null);
  if (ttfbSec == null || ttfbSec === 0) {
    // Fallback a texto
    const a = audits?.["server-response-time"] || audits?.["time-to-first-byte"];
    const txt = a?.displayValue as string | undefined;
    if (txt) {
      const mMs = txt.match(/([\d.,]+)\s*ms/i);
      const mS = txt.match(/([\d.,]+)\s*s/i);
      if (mMs) ttfbSec = toSeconds(parseFloat(mMs[1].replace(",", ".")));
      else if (mS) ttfbSec = Math.round(parseFloat(mS[1].replace(",", ".")) * 10) / 10;
    }
  }

  // Oportunidades + hallazgos
  const all: Array<{ id: string; raw: any }> = Object.entries(audits).map(
    ([id, a]) => ({ id, raw: a })
  );

  const opportunities: any[] = [];
  const errors: any[] = [];
  const improvements: any[] = [];

  for (const { id, raw: a } of all) {
    const title = lang === "es" ? tTitle(a?.title || id) : (a?.title || id);
    const description = lang === "es" ? tRich(a?.description || "") : (a?.description || "");

    const d = a?.details || {};
    const hasOpp =
      d?.type === "opportunity" ||
      typeof d?.overallSavingsMs === "number" ||
      typeof d?.overallSavingsBytes === "number";

    if (hasOpp) {
      opportunities.push({
        id,
        title,
        recommendation: description,
        savingsLabel: savingsLabelFromAudit(a),
        impactScore:
          (typeof d?.overallSavingsMs === "number" ? d.overallSavingsMs : 0) +
          (typeof d?.overallSavingsBytes === "number" ? Math.min(d.overallSavingsBytes / 10, 1000) : 0),
        status: "info",
        type: "improvement",
      });
      continue;
    }

    const score = typeof a?.score === "number" ? a.score : null;
    if (typeof score === "number") {
      const item = {
        id,
        title,
        description,
        displayValue: a?.displayValue || "",
        details: a?.details || null,
        score,
      };
      if (score < 0.5) errors.push(item);
      else if (score < 1) improvements.push(item);
    }
  }

  opportunities.sort((b, a) => ((a?.impactScore || 0) - (b?.impactScore || 0)));
  errors.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  improvements.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  return {
    metrics: {
      performance:
        typeof payload?.performance === "number" ? Math.round(payload.performance) : null,
      fcp: fcpSec,
      lcp: lcpSec,
      si: siSec,
      ttfb: ttfbSec,
      tbt: tbtMs, // ms
    },
    opportunities,
    errors,
    improvements,
    screenshot: getFinalScreenshotBase64(payload),
  };
}

// Markdown de “Plan de acción” (opcional para el front)
function buildPlanMarkdownEs(proc: ReturnType<typeof buildProcessedFromPayload>): string {
  const lines: string[] = ["## Plan de acción", ""];
  const items = [
    ...proc.opportunities.map((o: any) => ({
      title: o.title,
      recommendation: o.recommendation,
      savings: o.savingsLabel,
    })),
  ];

  for (const it of items) {
    const rec = (it.recommendation || "").replace(/\s+/g, " ").trim();
    const saving = it.savings ? ` (ahorro: ${it.savings})` : "";
    lines.push(`- [ ] ${rec || it.title}${saving}`);
  }
  return lines.join("\n");
}

// ───────────────────────────────────────────────────────────────────────────────
// Express app
// ───────────────────────────────────────────────────────────────────────────────


const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Logging HTTP básico
app.use(morgan('combined'));

// Endpoint POST /audit para compatibilidad con gateway
app.post("/audit", async (req: Request, res: Response) => {
  try {
    const { url, strategy = "mobile", categories = ["performance"] } = req.body;
    
    if (!url) return res.status(400).json({ error: "url is required" });

    const payload = await runPageSpeed({ url, strategy, categories });
    
    res.json(payload);
  } catch (e: any) {
    console.error(`[pagespeed] error:`, e?.message || String(e));
    res.status(500).json({ error: "Internal error", detail: e?.message || String(e) });
  }
});

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pagespeed", ts: new Date().toISOString() });
});

/**
 * GET /api/pagespeed
 *   ?url=...
 *   &strategy=mobile|desktop
 *   &categories=performance,accessibility,best-practices,seo
 *   &lang=es|en   (por defecto: es)
 *
 * Devuelve payload unificado + processed (traducido si lang=es)
 */
app.get("/api/pagespeed", async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || "").trim();
    if (!url) return res.status(400).json({ error: "Falta parámetro ?url" });

    const strategy = (String(req.query.strategy || "mobile").toLowerCase() as
      | "mobile"
      | "desktop");

    const VALID_CATEGORIES = new Set(["performance", "accessibility", "best-practices", "seo"]);
    const aliasMap: Record<string, string> = {
      a11y: "accessibility",
      bp: "best-practices",
      bestpractices: "best-practices",
      all: "all",
    };

    const q = req.query as any;
    const rawCats = Array.isArray(q?.categories)
      ? q.categories
      : (typeof q?.categories === "string" && q.categories.trim())
      ? String(q.categories).split(",")
      : null;

    const normalized = rawCats
      ? rawCats.map((s: any) => String(s).trim().toLowerCase()).map((c: string) => aliasMap[c] || c)
      : null;

    const parsed = normalized
      ? normalized
          .filter(Boolean)
          .filter((c: string) => c === "all" || VALID_CATEGORIES.has(c))
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      : null;

    // ✅ FULL por defecto; opcionalmente ?lite=1 para pedir solo performance
    const wantsLite =
      String(q?.lite ?? "").toLowerCase() === "1" || String(q?.lite ?? "").toLowerCase() === "true";

    const categories =
      parsed && parsed.length && !parsed.includes("all")
        ? parsed
        : wantsLite
        ? ["performance"]
        : ["performance", "accessibility", "best-practices", "seo"];

    const lang = (String(req.query.lang || "es").toLowerCase() === "es" ? "es" : "en");

    const payload = await runPageSpeed({ url, strategy, categories });

    const processed = buildProcessedFromPayload(payload, lang);
    const plan_es = lang === "es" ? buildPlanMarkdownEs(processed) : undefined;

    res.json({ ...payload, processed, i18n: { lang }, plan_es });
  } catch (e: any) {
    console.error("[/api/pagespeed] error:", e?.message || e);
    res.status(500).json({ error: "Error interno" });
  }
});


/**
 * GET /api/pagespeed/processed
 *   Igual al anterior, pero devuelve solo el bloque “processed”
 */
app.get("/api/pagespeed/processed", async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || "").trim();
    if (!url) return res.status(400).json({ error: "Falta parámetro ?url" });

    const strategy = (String(req.query.strategy || "mobile").toLowerCase() as
      | "mobile"
      | "desktop");

    // ✅ MISMA LÓGICA DE CATEGORÍAS QUE /api/pagespeed
    const VALID_CATEGORIES = new Set(["performance", "accessibility", "best-practices", "seo"]);
    const aliasMap: Record<string, string> = {
      a11y: "accessibility",
      bp: "best-practices",
      bestpractices: "best-practices",
      all: "all",
    };

    const q = req.query as any;
    const rawCats = Array.isArray(q?.categories)
      ? q.categories
      : (typeof q?.categories === "string" && q.categories.trim())
      ? String(q.categories).split(",")
      : null;

    const normalized = rawCats
      ? rawCats.map((s: any) => String(s).trim().toLowerCase()).map((c: string) => aliasMap[c] || c)
      : null;

    const parsed = normalized
      ? normalized
          .filter(Boolean)
          .filter((c: string) => c === "all" || VALID_CATEGORIES.has(c))
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      : null;

    const wantsLite =
      String(q?.lite ?? "").toLowerCase() === "1" || String(q?.lite ?? "").toLowerCase() === "true";

    const categories =
      parsed && parsed.length && !parsed.includes("all")
        ? parsed
        : wantsLite
        ? ["performance"]
        : ["performance", "accessibility", "best-practices", "seo"];

    const lang = (String(req.query.lang || "es").toLowerCase() === "es" ? "es" : "en");

    const payload = await runPageSpeed({ url, strategy, categories });
    const processed = buildProcessedFromPayload(payload, lang);
    const plan_es = lang === "es" ? buildPlanMarkdownEs(processed) : undefined;

    res.json({ processed, plan_es, i18n: { lang } });
  } catch (e: any) {
    console.error("[/api/pagespeed/processed] error:", e?.message || e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ───────────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PS_PORT || 3001);
app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
});