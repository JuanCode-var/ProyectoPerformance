import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 5 * 60 });          // 5 min
const LH_BASE = {
  extends: 'lighthouse:default',
  settings: {
    throttlingMethod: 'simulate',
    throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    maxWaitForLoad: 45_000
  }
};

async function auditOnce (url, formFactor, categories) {
  const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  try {
    const cfg = structuredClone(LH_BASE);
    cfg.settings.formFactor = formFactor;
    cfg.settings.onlyCategories = categories;
    const { lhr } = await lighthouse(url, { port: chrome.port }, cfg);
    return {
      performance: Math.round(lhr.categories.performance.score * 100),
      fcp : lhr.audits['first-contentful-paint'].numericValue,
      lcp : lhr.audits['largest-contentful-paint'].numericValue,
      cls : lhr.audits['cumulative-layout-shift'].numericValue,
      tbt : lhr.audits['total-blocking-time'].numericValue,
      si  : lhr.audits['speed-index'].numericValue,
      ttfb: lhr.audits['server-response-time'].numericValue
    };
  } finally { await chrome.kill(); }
}

export async function runPageSpeed ({ url, strategy = 'mobile', categories = ['performance'] }) {
  const key = `${url}|${strategy}|${categories.join(',')}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, fromCache: true };

  const metrics = await auditOnce(url, strategy, categories);
  cache.set(key, metrics);
  return {
    url, strategy,
    fetchedAt: new Date().toISOString(),
    performance: metrics.performance,
    categoryScores: { performance: metrics.performance },
    metrics
  };
}
