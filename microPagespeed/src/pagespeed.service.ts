// microPagespeed/src/pagespeed.service.ts
import axios from "axios";
import http from "http";
import https from "https";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import type { Flags } from "lighthouse";

/**
 * I18N: importamos las utilidades de traducción
 * - Si tu package.json tiene "type":"module", DEJA el .js al final.
 * - Si NO usas ESM, cambia a:  ../lib/lh-i18n-es
 */
import { tTitle, tRich, tSavings } from "./lib/lh-i18n-es.js";

// ✅ Base sin query
const endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// Cache simple en memoria (1h) por url+strategy
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

// Pre-chequeo barato para detectar bloqueo por WAF a Lighthouse
async function psiLikelyBlocked(url: string): Promise<boolean> {
  try {
    const common = {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { "User-Agent": "Chrome-Lighthouse" },
    };
    let r = await axios.head(url, common);
    if (r.status === 405) {
      r = await axios.get(url, {
        ...common,
        headers: { ...common.headers, Range: "bytes=0-0" },
      });
    }
    return r.status === 403 || r.status === 404; // bloqueado o no servido a bots
  } catch {
    return true;
  }
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

/** 🔵 Localiza el LHR IN-PLACE (ES).
 *  - Traduce title/description/displayValue en audits.
 *  - Marca el LHR como localizado.
 */
function localizeLhrInPlace(lhr: any) {
  try {
    const audits = lhr?.audits || {};
    for (const id of Object.keys(audits)) {
      const a = audits[id] || {};
      if (typeof a.title === "string") a.title = tTitle(a.title);
      if (typeof a.description === "string")
        a.description = tRich(a.description);
      if (typeof a.displayValue === "string")
        a.displayValue = tSavings(a.displayValue);
      // Algunos audits tienen subtextos en details; no tocamos items/headers
      // para evitar reemplazar URLs o labels dinámicos.
    }
    // (Opcional) Puedes marcar que ya viene en ES
    (lhr as any).__i18n = "es";
  } catch {
    // ignoramos cualquier problema de i18n para no romper la respuesta
  }
}

/** 🔵 Construye un "plan de acción" simple (opportunities + algunos diagnostics) ya en ES */
function buildPlanChecklistEs(lhr: any) {
  const audits = lhr?.audits || {};
  const list: Array<{ title: string; recommendation: string; savings: string }> =
    [];

  for (const id of Object.keys(audits)) {
    const a = audits[id] || {};
    const d = a.details || {};
    const isOpp = d?.type === "opportunity";
    const hasSavings =
      typeof d?.overallSavingsMs === "number" ||
      typeof d?.overallSavingsBytes === "number" ||
      /savings/i.test(String(a.displayValue || ""));

    if (isOpp || hasSavings) {
      // Savings label amigable
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

  // Ordén básico por “impacto” (heurística): ms primero, luego bytes
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

  // Markdown de checklist (como el que pegaste)
  const md = list
    .map(
      (x) =>
        `- [ ] ${x.recommendation || x.title}${
          x.savings ? ` (ahorro: ${x.savings})` : ""
        }`
    )
    .join("\n");

  return { items: list, markdown: md };
}

// ---------- Tipos/entrada ----------
export type RunPageSpeedArgs = {
  url: string;
  strategy?: "mobile" | "desktop" | (string & {});
  categories?: string[]; // Ej: ["performance","accessibility","best-practices","seo"]
  key?: string;
};

// ---------- Entrada pública ----------
export async function runPageSpeed({
  url,
  strategy = "mobile",
  categories = ["performance"],
  key,
}: RunPageSpeedArgs): Promise<any> {
  // 1) Normaliza URL y cache
  const cleanUrl = sanitizeUrl(url);
  const cacheKey = `${cleanUrl}::${strategy}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) {
    console.log("[micro] cache hit → source=%s", hit.data?.meta?.source);
    return hit.data;
  }

  // 2) Key efectiva
  const envKey = (process.env.PSI_API_KEY || process.env.PAGESPEED_API_KEY || "").trim();
  const effectiveKey = (key || envKey || "").trim();
  console.log(
    "[micro] PSI key in use:",
    effectiveKey ? `****${effectiveKey.slice(-6)}` : "none"
  );

  // 3) Preflight: si WAF bloquea a Lighthouse, evita PSI y usa local
  if (await psiLikelyBlocked(cleanUrl)) {
    console.warn("[micro] PSI bloqueado por WAF (preflight). Usando local.");
    const payload = await runLocalLighthouse({ url: cleanUrl, strategy, categories });
    cache.set(cacheKey, { time: Date.now(), data: payload });
    return payload;
  }

  // 4) Construye URL PSI
  const u = encodeURIComponent(cleanUrl);
  const cats = (categories || [])
    .map((c) => `category=${encodeURIComponent(c)}`)
    .join("&");
  const keyPart = effectiveKey ? `&key=${effectiveKey}` : "";
  const full = `${endpoint}?url=${u}&strategy=${strategy}&${cats}${keyPart}`;

  // 5) Llama PSI con reintentos (backoff 2s, 5s, 10s)
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      console.log("[micro] PSI about to call → url:", cleanUrl);
      const t0 = Date.now();
      const { data } = await axios.get(full, {
        httpAgent,
        httpsAgent,
        timeout: 300000,
        validateStatus: (s) => s >= 200 && s < 300,
        decompress: true,
      });
      const durationMs = Date.now() - t0;

      // 🔵 Localizamos el LHR de PSI antes de empaquetar
      if (data?.lighthouseResult) {
        localizeLhrInPlace(data.lighthouseResult);
      }

      console.log("[micro] PSI OK (attempt %d) ms=%d", attempt, durationMs);
      const payload = toPayloadFromPSI(data, durationMs, strategy);
      cache.set(cacheKey, { time: Date.now(), data: payload });
      return payload;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error?.message || e?.message || String(e);
      const retryAfter = e?.response?.headers?.["retry-after"];
      console.error("[micro] PSI fail (attempt %d): %s %s", attempt, status ?? "-", msg);
      if (retryAfter) console.error("[micro] Retry-After header:", retryAfter);

      if ((status === 429 || (status >= 500 && status <= 599)) && attempt < 3) {
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : [2000, 5000, 10000][attempt];
        console.log("[micro] PSI retry in %dms", waitMs);
        await sleep(waitMs);
        continue;
      }

      if (status === 404 || status === 403) {
        console.warn("[micro] PSI 4xx (posible login/robots/WAF). Fallback a local.");
      }
      break; // cae a local
    }
  }

  // 6) Fallback: Lighthouse local
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

  // 🔵 Plan en ES ya listo (markdown e items)
  const plan = buildPlanChecklistEs(lhr);

  return {
    url: data?.id || lhr?.finalUrl,
    strategy,
    fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
    performance: categoryScores.performance ?? perfScore,
    categoryScores,
    metrics,
    plan_es: plan, // ← { markdown, items[] } en español
    meta: {
      finalUrl: lhr?.finalUrl,
      lighthouseVersion: lhr?.lighthouseVersion,
      userAgent: lhr?.userAgent,
      configSettings: lhr?.configSettings,
      duration_ms: durationMs,
      source: "psi",
      i18n: "es",
    },
    raw: data, // ← audits/titles/descriptions ya vienen localizados
  };
}

// ---------- Lighthouse local ----------
async function runLocalLighthouse({
  url,
  strategy = "mobile",
  categories = ["performance"],
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
    } as const;

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

    // 🔵 Localizamos el LHR local antes de empaquetar
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
      plan_es: plan, // ← en español
      meta: {
        finalUrl: lhr?.finalUrl,
        lighthouseVersion: lhr?.lighthouseVersion,
        userAgent: lhr?.userAgent,
        configSettings: lhr?.configSettings,
        duration_ms: durationMs,
        source: "local",
        i18n: "es",
      },
      raw: lhr, // ← audits en ES
    };
  } finally {
    await chrome.kill();
  }
}