import axios from "axios";
import http from "http";
import https from "https";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import type { Flags } from "lighthouse";

/**
 * I18N: utilidades de traducción (fallback)
 */
import { tTitle, tRich, tSavings } from "./lib/lh-i18n-es.js";

// ✅ Base sin query
const endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// Cache simple en memoria (1h) por url+strategy+categories
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { time: number; data: any }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Quita parámetros de tracking que a veces disparan WAF/reglas
function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "msclkid",
    ].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return raw;
  }
}

// (Opcional: lo dejamos por si quieres reactivarlo en el futuro)
async function psiLikelyBlocked(_url: string): Promise<boolean> {
  return false;
}

// ---------- Helpers de extracción ----------
function extractMetricsFromLHR(lhr: any) {
  const audits = lhr?.audits || {};
  return {
    fcp: audits["first-contentful-paint"]?.numericValue ?? null,
    lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    tbt: audits["total-blocking-time"]?.numericValue ?? null,
    si: audits["speed-index"]?.numericValue ?? null,
    ttfb: audits["server-response-time"]?.numericValue ?? null,
  };
}

function extractCategoryScores(lhr: any) {
  const cats = lhr?.categories || {};
  const out: Record<string, number> = {};
  (["performance", "accessibility", "best-practices", "seo"] as const).forEach(
    (k) => {
      const s = cats?.[k]?.score;
      if (typeof s === "number" && !Number.isNaN(s)) {
        out[k] = Math.round(s * 100);
      }
    }
  );
  return out;
}

/** 🔵 Localiza el LHR IN-PLACE (ES). */
function localizeLhrInPlace(lhr: any) {
  try {
    const audits = lhr?.audits || {};
    for (const id of Object.keys(audits)) {
      const a = audits[id] || {};
      if (typeof a.title === "string") a.title = tTitle(a.title);
      if (typeof a.description === "string") a.description = tRich(a.description);
      if (typeof a.displayValue === "string") a.displayValue = tSavings(a.displayValue);
    }
    (lhr as any).__i18n = "es";
  } catch {
    // no romper por i18n
  }
}

/** 🔵 Plan de acción simple (opportunities + algunos diagnostics) ya en ES */
function buildPlanChecklistEs(lhr: any) {
  const audits = lhr?.audits || {};
  const list: Array<{ title: string; recommendation: string; savings: string }> = [];

  for (const id of Object.keys(audits)) {
    const a = audits[id] || {};
    const d = a.details || {};
    const isOpp = d?.type === "opportunity";
    const hasSavings =
      typeof d?.overallSavingsMs === "number" ||
      typeof d?.overallSavingsBytes === "number" ||
      /savings/i.test(String(a.displayValue || ""));

    if (isOpp || hasSavings) {
      let savings = "";
      if (typeof d?.overallSavingsMs === "number" && d.overallSavingsMs > 0) {
        const ms = d.overallSavingsMs;
        savings = ms >= 100 ? `${Math.round((ms / 1000) * 10) / 10}s` : `${Math.round(ms)}ms`;
      } else if (typeof d?.overallSavingsBytes === "number" && d.overallSavingsBytes > 0) {
        const kb = d.overallSavingsBytes / 1024;
        savings = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
      } else if (typeof a.displayValue === "string") {
        savings = tSavings(a.displayValue);
      }

      list.push({
        title: tTitle(a.title || id),
        recommendation: tRich(a.description || ""),
        savings,
      });
    }
  }

  const score = (x: (typeof list)[number]) => {
    const m = x.savings.match(/([\d.]+)\s*s/);
    const ms = x.savings.match(/([\d.]+)\s*ms/);
    const kb = x.savings.match(/([\d.]+)\s*KB/i);
    const mb = x.savings.match(/([\d.]+)\s*MB/i);
    if (m) return parseFloat(m[1]) * 10000;
    if (mb) return parseFloat(mb[1]) * 1000;
    if (kb) return parseFloat(kb[1]) * 10;
    if (ms) return parseFloat(ms[1]);
    return 0;
  };
  list.sort((b, a) => score(a) - score(b));

  const md = list
    .map(
      (x) =>
        `- [ ] ${x.recommendation || x.title}${x.savings ? ` (ahorro: ${x.savings})` : ""}`
    )
    .join("\n");

  return { items: list, markdown: md };
}

// ---------- Tipos/entrada ----------
export type RunPageSpeedArgs = {
  url: string;
  strategy?: "mobile" | "desktop" | (string & {});
  categories?: string[]; // ["performance","accessibility","best-practices","seo"]
  key?: string;
};

// ---------- Entrada pública ----------
export async function runPageSpeed({
  url,
  strategy = "mobile",
  categories = ["performance", "accessibility", "best-practices", "seo"], // ✅ FULL por defecto
  key,
}: RunPageSpeedArgs): Promise<any> {
  // 1) Normaliza URL y cache
  const cleanUrl = sanitizeUrl(url);
  const catsKey = (categories || []).slice().sort().join("|"); // cache por set de categorías
  const cacheKey = `${cleanUrl}::${strategy}::${catsKey}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) {
    console.log("[micro] cache hit → source=%s", hit.data?.meta?.source);
    return hit.data;
  }

  // 2) Key efectiva
  const envKey = (process.env.PSI_API_KEY || process.env.PAGESPEED_API_KEY || "").trim();
  const effectiveKey = (key || envKey || "").trim();

  // 3) (REMOVIDO) Preflight WAF — siempre intentamos PSI primero
  
  // 4) Construye URL PSI (ES)
  const params = new URLSearchParams();
  params.set("url", cleanUrl);
  params.set("strategy", strategy);
  (categories || []).forEach((c) => params.append("category", c));
  if (effectiveKey) params.set("key", effectiveKey);
  params.set("locale", "es");
  params.set("hl", "es");

  const full = `${endpoint}?${params.toString()}`;

  // 5) PSI con reintentos (2s, 5s, 10s)
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      console.log(`[micro] PSI about to call → url: ${cleanUrl}`);
      const t0 = Date.now();
      const { data } = await axios.get(full, {
        httpAgent,
        httpsAgent,
        timeout: 300000,
        validateStatus: (s) => s >= 200 && s < 300,
        decompress: true,
      });
      const durationMs = Date.now() - t0;

      if (data?.lighthouseResult) localizeLhrInPlace(data.lighthouseResult);

      console.log("[micro] PSI OK (attempt %d) ms=%d", attempt, durationMs);
      const payload = toPayloadFromPSI(data, durationMs, strategy);
      cache.set(cacheKey, { time: Date.now(), data: payload });
      return payload;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error?.message || e?.message || String(e);
      const retryAfter = e?.response?.headers?.["retry-after"];
      console.log(`[micro] PSI fail (attempt ${attempt}): ${status || 429} Request failed with status code ${status || 429}`);
      console.log(`[micro] PSI retry in ${[2000, 5000, 10000][attempt] || 10000}ms`);
      
      if (retryAfter) console.error("[micro] Retry-After header:", retryAfter);

      if ((status === 429 || (status >= 500 && status <= 599)) && attempt < 3) {
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : [2000, 5000, 10000][attempt];
        console.log("[micro] PSI retry in %dms", waitMs);
        await sleep(waitMs);
        continue;
      }
      break; // cae a local
    }
  }

  // 6) Fallback: Lighthouse local (solo si PSI realmente falla)
  console.log("[micro] PSI exhausted or failed. Falling back to local Lighthouse...");
  const payload = await runLocalLighthouse({ url: cleanUrl, strategy, categories });
  cache.set(cacheKey, { time: Date.now(), data: payload });
  console.log("[micro] source=local ms=%d", payload?.meta?.duration_ms ?? -1);
  return payload;
}

// ---------- PSI → payload unificado ----------
function toPayloadFromPSI(data: any, durationMs: number, strategy: string) {
  const lhr = data?.lighthouseResult;
  const metrics = extractMetricsFromLHR(lhr);
  const categoryScores = extractCategoryScores(lhr);
  const perfScore =
    typeof lhr?.categories?.performance?.score === "number"
      ? Math.round(lhr.categories.performance.score * 100)
      : 0;

  // 🔵 Plan en ES
  const plan = buildPlanChecklistEs(lhr);

  return {
    url: data?.id || lhr?.finalUrl,
    strategy,
    fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
    performance: categoryScores.performance ?? perfScore,
    categoryScores,
    metrics,
    plan_es: plan,
    meta: {
      finalUrl: lhr?.finalUrl,
      lighthouseVersion: lhr?.lighthouseVersion,
      userAgent: lhr?.userAgent,
      configSettings: lhr?.configSettings,
      duration_ms: durationMs,
      source: "psi",
      i18n: "es",
    },
    raw: data,
  };
}

// ---------- Lighthouse local ----------
async function runLocalLighthouse({
  url,
  strategy = "mobile",
  categories = ["performance", "accessibility", "best-practices", "seo"], // ✅ FULL por defecto
}: {
  url: string;
  strategy?: "mobile" | "desktop" | (string & {});
  categories?: string[];
}): Promise<any> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  try {
    const opts: Flags = {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      // 👇 Localización para Lighthouse local
      locale: "es",
    } as any;

    const config = {
      extends: "lighthouse:default",
      settings: {
        onlyCategories: categories,
        formFactor: strategy === "mobile" ? "mobile" : "desktop",
        screenEmulation:
          strategy === "mobile"
            ? {
                mobile: true,
                width: 360,
                height: 640,
                deviceScaleFactor: 2,
                disabled: false,
              }
            : {
                mobile: false,
                width: 1350,
                height: 940,
                deviceScaleFactor: 1,
                disabled: false,
              },
        throttling:
          strategy === "mobile"
            ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }
            : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
      },
    };

    const t0 = Date.now();
    const rr: any = await lighthouse(url, opts, config as any);
    const durationMs = Date.now() - t0;

    const lhr = rr?.lhr;

    // 🔵 Localizamos el LHR local (fallback)
    localizeLhrInPlace(lhr);

    const metrics = extractMetricsFromLHR(lhr);
    const categoryScores = extractCategoryScores(lhr);
    const perfScore =
      typeof lhr?.categories?.performance?.score === "number"
        ? Math.round(lhr.categories.performance.score * 100)
        : 0;

    const plan = buildPlanChecklistEs(lhr);

    return {
      url: lhr?.finalUrl || url,
      strategy,
      fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
      performance: categoryScores.performance ?? perfScore,
      categoryScores,
      metrics,
      plan_es: plan,
      meta: {
        finalUrl: lhr?.finalUrl,
        lighthouseVersion: lhr?.lighthouseVersion,
        userAgent: lhr?.userAgent,
        configSettings: lhr?.configSettings,
        duration_ms: durationMs,
        source: "local",
        i18n: "es",
      },
      raw: lhr,
    };
  } finally {
    await chrome.kill();
  }
}