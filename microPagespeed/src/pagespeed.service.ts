// microPagespeed/src/pagespeed.service.ts
import axios from "axios";
import http from "http";
import https from "https";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import type { Flags } from "lighthouse";

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
    // Si ni siquiera podemos hacer HEAD/GET mínimo, trátalo como bloqueado
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
    console.log("[micro] cache hit → source=%s", hit.data?.meta?.source); // eslint-disable-line no-console
    return hit.data;
  }

  // 2) Key efectiva
  const envKey = (process.env.PSI_API_KEY || process.env.PAGESPEED_API_KEY || "").trim();
  const effectiveKey = (key || envKey || "").trim();
  console.log(
    "[micro] PSI key in use:",
    effectiveKey ? `****${effectiveKey.slice(-6)}` : "none"
  ); // eslint-disable-line no-console

  // 3) Preflight: si WAF bloquea a Lighthouse, evita PSI y usa local
  if (await psiLikelyBlocked(cleanUrl)) {
    console.warn("[micro] PSI bloqueado por WAF (preflight). Usando local."); // eslint-disable-line no-console
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
      console.log("[micro] PSI about to call → url:", cleanUrl); // eslint-disable-line no-console
      const t0 = Date.now();
      const { data } = await axios.get(full, {
        httpAgent,
        httpsAgent,
        timeout: 300000,
        validateStatus: (s) => s >= 200 && s < 300,
        decompress: true,
      });
      const durationMs = Date.now() - t0;

      console.log("[micro] PSI OK (attempt %d) ms=%d", attempt, durationMs); // eslint-disable-line no-console
      const payload = toPayloadFromPSI(data, durationMs, strategy);
      cache.set(cacheKey, { time: Date.now(), data: payload });
      return payload;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.error?.message || e?.message || String(e);
      const retryAfter = e?.response?.headers?.["retry-after"];
      console.error("[micro] PSI fail (attempt %d): %s %s", attempt, status ?? "-", msg); // eslint-disable-line no-console
      if (retryAfter) console.error("[micro] Retry-After header:", retryAfter); // eslint-disable-line no-console

      // 429 o 5xx → reintenta
      if ((status === 429 || (status >= 500 && status <= 599)) && attempt < 3) {
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : [2000, 5000, 10000][attempt];
        console.log("[micro] PSI retry in %dms", waitMs); // eslint-disable-line no-console
        await sleep(waitMs);
        continue;
      }

      // 403/404 típicos (login/robots/WAF) → corta a local
      if (status === 404 || status === 403) {
        console.warn("[micro] PSI 4xx (posible login/robots/WAF). Fallback a local."); // eslint-disable-line no-console
      }
      break; // cae a local
    }
  }

  // 6) Fallback: Lighthouse local
  const payload = await runLocalLighthouse({ url: cleanUrl, strategy, categories });
  cache.set(cacheKey, { time: Date.now(), data: payload });
  console.log("[micro] source=local ms=%d", payload?.meta?.duration_ms ?? -1); // eslint-disable-line no-console
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

  return {
    url: data?.id || lhr?.finalUrl,
    strategy,
    fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
    performance: categoryScores.performance ?? perfScore, // compat
    categoryScores, // ← performance, accessibility, best-practices, seo
    metrics,
    meta: {
      finalUrl: lhr?.finalUrl,
      lighthouseVersion: lhr?.lighthouseVersion,
      userAgent: lhr?.userAgent,
      configSettings: lhr?.configSettings,
      duration_ms: durationMs,
      source: "psi",
    },
    raw: data,
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
  // 👇 Lanzamos Chrome y recién ahí usamos chrome.port
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
        onlyCategories: categories, // ← respetar lo pedido por el caller
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
    const metrics = extractMetricsFromLHR(lhr);
    const categoryScores = extractCategoryScores(lhr);
    const perfScore =
      typeof lhr?.categories?.performance?.score === "number"
        ? Math.round(lhr.categories.performance.score * 100)
        : 0;

    return {
      url: lhr?.finalUrl || url,
      strategy,
      fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
      performance: categoryScores.performance ?? perfScore, // compat
      categoryScores, // ← performance, accessibility, best-practices, seo
      metrics,
      meta: {
        finalUrl: lhr?.finalUrl,
        lighthouseVersion: lhr?.lighthouseVersion,
        userAgent: lhr?.userAgent,
        configSettings: lhr?.configSettings,
        duration_ms: durationMs,
        source: "local",
      },
      raw: lhr,
    };
  } finally {
    await chrome.kill();
  }
}