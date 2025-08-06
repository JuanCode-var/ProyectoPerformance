// pagespeed.service.js
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 5 * 60 }); // 5 min

const LH_BASE = {
  extends: 'lighthouse:default',
  settings: {
    throttlingMethod: 'simulate',
    throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    maxWaitForLoad: 45_000
  }
};

// Ejecuta una sola corrida de Lighthouse
async function auditOnce(url, formFactor, categories) {
  const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  try {
    const cfg = structuredClone(LH_BASE);
    cfg.settings.formFactor = formFactor;
    cfg.settings.onlyCategories = categories;
    const { lhr } = await lighthouse(url, { port: chrome.port }, cfg);
    return {
      performance: Math.round(lhr.categories.performance.score * 100),
      fcp:  lhr.audits['first-contentful-paint'].numericValue,
      lcp:  lhr.audits['largest-contentful-paint'].numericValue,
      cls:  lhr.audits['cumulative-layout-shift'].numericValue,
      tbt:  lhr.audits['total-blocking-time'].numericValue,
      si:   lhr.audits['speed-index'].numericValue,
      ttfb: lhr.audits['server-response-time'].numericValue
    };
  } finally {
    await chrome.kill();
  }
}

// Calcula la mediana de un array numérico
function median(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 0 ? Math.round((a[mid - 1] + a[mid]) / 2) : Math.round(a[mid]);
}

/**
 * Ejecuta N corridas de Lighthouse y devuelve la mediana de cada métrica.
 */
export async function runPageSpeed({ url, strategy = 'mobile', categories = ['performance'] }) {
  const key = `${url}|${strategy}|${categories.join(',')}`;
  const cached = cache.get(key);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const runs = 3;
  const allResults = [];
  for (let i = 0; i < runs; i++) {
    allResults.push(await auditOnce(url, strategy, categories));
  }

  // Extraemos arrays de cada métrica
  const perfArr = allResults.map(r => r.performance);
  const fcpArr  = allResults.map(r => r.fcp);
  const lcpArr  = allResults.map(r => r.lcp);
  const clsArr  = allResults.map(r => r.cls);
  const tbtArr  = allResults.map(r => r.tbt);
  const siArr   = allResults.map(r => r.si);
  const ttfbArr = allResults.map(r => r.ttfb);

  // Medianas
  const metrics = {
    performance: median(perfArr),
    fcp:         median(fcpArr),
    lcp:         median(lcpArr),
    cls:         median(clsArr),
    tbt:         median(tbtArr),
    si:          median(siArr),
    ttfb:        median(ttfbArr)
  };

  const payload = {
    url,
    strategy,
    fetchedAt:    new Date().toISOString(),
    performance:  metrics.performance,
    categoryScores: { performance: metrics.performance },
    metrics
  };

  cache.set(key, payload);
  return payload;
}
