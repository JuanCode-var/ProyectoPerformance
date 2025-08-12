// microPagespeed/src/pagespeed.service.js
import axios from 'axios';
import http from 'http';
import https from 'https';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const endpoint   = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const httpAgent  = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// Cache simple en memoria (1h) por url+strategy
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map(); // key -> { time, data }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function runPageSpeed({
  url,
  strategy = 'mobile',
  categories = ['performance'],
  key = process.env.PSI_API_KEY
}) {
  const cacheKey = `${url}::${strategy}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) {
    console.log('[micro] cache hit → source=%s', hit.data?.meta?.source);
    return hit.data;
  }

  const u = encodeURIComponent(url);
  const cats = categories.map(c => `category=${c}`).join('&');
  const keyPart = key ? `&key=${key}` : '';
  const full = `${endpoint}?url=${u}&strategy=${strategy}&${cats}${keyPart}`;

  // ——— 1) PSI primero con hasta 3 reintentos (respeta Retry-After en 429) ———
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      const { data } = await axios.get(full, {
        httpAgent,
        httpsAgent,
        timeout: 300000,
        validateStatus: s => s >= 200 && s < 300,
        decompress: true
      });
      const durationMs = Date.now() - t0;

      const payload = toPayloadFromPSI(data, durationMs, strategy);
      cache.set(cacheKey, { time: Date.now(), data: payload });
      console.log('[micro] source=psi ms=%d', durationMs);
      return payload;
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error?.message || e.message;
      console.error('[micro] PSI fail (attempt %d): %s %s', attempt, status ?? '-', detail);

      // Reintenta en 429 o 5xx
      if ((status === 429 || (status >= 500 && status <= 599)) && attempt < 3) {
        const ra = e.response?.headers?.['retry-after'];
        const waitMs = ra ? Number(ra) * 1000 : 1000 * Math.pow(2, attempt + 1); // 1s,2s,4s
        await sleep(waitMs);
        continue;
      }
      break; // no reintentar más → caer a local
    }
  }

  // ——— 2) Fallback: Lighthouse local ———
  const payload = await runLocalLighthouse({ url, strategy, categories });
  cache.set(cacheKey, { time: Date.now(), data: payload });
  console.log('[micro] source=local ms=%d', payload?.meta?.duration_ms ?? -1);
  return payload;
}

function toPayloadFromPSI(data, durationMs, strategy) {
  const lhr = data.lighthouseResult;
  const audits = lhr?.audits || {};
  const metrics = {
    fcp:  audits['first-contentful-paint']?.numericValue ?? null,
    lcp:  audits['largest-contentful-paint']?.numericValue ?? null,
    cls:  audits['cumulative-layout-shift']?.numericValue ?? null,
    tbt:  audits['total-blocking-time']?.numericValue ?? null,
    si:   audits['speed-index']?.numericValue ?? null,
    ttfb: audits['server-response-time']?.numericValue ?? null
  };
  const perfScore = Math.round((lhr?.categories?.performance?.score ?? 0) * 100);

  return {
    url: data.id || lhr?.finalUrl,
    strategy,
    fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
    performance: perfScore,
    categoryScores: { performance: perfScore },
    metrics,
    meta: {
      finalUrl: lhr?.finalUrl,
      lighthouseVersion: lhr?.lighthouseVersion,
      userAgent: lhr?.userAgent,
      configSettings: lhr?.configSettings,
      duration_ms: durationMs,
      source: 'psi'
    },
    raw: data
  };
}

async function runLocalLighthouse({ url, strategy = 'mobile', categories = ['performance'] }) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    const opts = { port: chrome.port, logLevel: 'error', output: 'json' };
    const config = {
      extends: 'lighthouse:default',
      settings: {
        onlyCategories: categories,
        formFactor: strategy === 'mobile' ? 'mobile' : 'desktop',
        screenEmulation: strategy === 'mobile'
          ? { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false }
          : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        throttling: strategy === 'mobile'
          ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }
          : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
      }
    };

    const t0 = Date.now();
    const rr = await lighthouse(url, opts, config);
    const durationMs = Date.now() - t0;

    const lhr = rr.lhr;
    const audits = lhr?.audits || {};
    const metrics = {
      fcp:  audits['first-contentful-paint']?.numericValue ?? null,
      lcp:  audits['largest-contentful-paint']?.numericValue ?? null,
      cls:  audits['cumulative-layout-shift']?.numericValue ?? null,
      tbt:  audits['total-blocking-time']?.numericValue ?? null,
      si:   audits['speed-index']?.numericValue ?? null,
      ttfb: audits['server-response-time']?.numericValue ?? null
    };
    const perfScore = Math.round((lhr?.categories?.performance?.score ?? 0) * 100);

    return {
      url: lhr?.finalUrl || url,
      strategy,
      fetchedAt: lhr?.fetchTime ?? new Date().toISOString(),
      performance: perfScore,
      categoryScores: { performance: perfScore },
      metrics,
      meta: {
        finalUrl: lhr?.finalUrl,
        lighthouseVersion: lhr?.lighthouseVersion,
        userAgent: lhr?.userAgent,
        configSettings: lhr?.configSettings,
        duration_ms: durationMs,
        source: 'local'
      },
      raw: lhr
    };
  } finally {
    await chrome.kill();
  }
}