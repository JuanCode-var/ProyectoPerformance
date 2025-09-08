import axios from 'axios';
import type { AxiosResponse } from 'axios';

export type SecurityFinding = {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  recommendation?: string;
  details?: any;
  scoreImpact?: number; // negative numbers subtract from score
};

export type CookieInfo = {
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string | null;
  domain?: string | null;
  path?: string | null;
  expires?: string | null;
  maxAge?: string | null;
  raw?: string;
};

export type EnvironmentProfile = {
  kind: 'api' | 'spa' | 'static' | 'ssr' | 'unknown';
  evidence?: string[];
  recommendations?: string[];
};

export type SecurityReport = {
  ok: boolean;
  meta: { source: 'custom'; service: 'security-service'; version: number; generatedAt: string };
  inputUrl: string;
  finalUrl: string;
  method: 'HEAD' | 'GET';
  status: number;
  headers: Record<string, string>;
  cookies: CookieInfo[];
  httpsEnforced: boolean; // http->https redirect present
  https: boolean; // final url uses https
  checks: Record<string, { ok: boolean; notes?: string }>; // quick summary
  score: number; // 0..100
  grade: 'A'|'B'|'C'|'D'|'E'|'F';
  findings: SecurityFinding[];
  environment?: EnvironmentProfile;
};

function toHeaderMap(h: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  Object.keys(h).forEach((k) => {
    const v = (h as any)[k];
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  });
  return out;
}

function parseSetCookie(setCookie: string | string[] | undefined): CookieInfo[] {
  const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookies: CookieInfo[] = [];
  for (const raw of lines) {
    const parts = raw.split(';').map((p) => p.trim());
    const [nameVal, ...attrs] = parts;
    if (!nameVal || !nameVal.includes('=')) continue;
    const [name, ...vrest] = nameVal.split('=');
    const value = vrest.join('=');
    const entry: CookieInfo = {
      name,
      value,
      secure: false,
      httpOnly: false,
      sameSite: null,
      domain: null,
      path: null,
      expires: null,
      maxAge: null,
      raw,
    };
    for (const a of attrs) {
      const [k, ...vr] = a.split('=');
      const key = k.trim().toLowerCase();
      const val = vr.join('=');
      if (key === 'secure') entry.secure = true;
      else if (key === 'httponly') entry.httpOnly = true;
      else if (key === 'samesite') entry.sameSite = val || '';
      else if (key === 'domain') entry.domain = val || '';
      else if (key === 'path') entry.path = val || '';
      else if (key === 'expires') entry.expires = val || '';
      else if (key === 'max-age') entry.maxAge = val || '';
    }
    cookies.push(entry);
  }
  return cookies;
}

function gradeFromScore(score: number): SecurityReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score >= 50) return 'E';
  return 'F';
}

function ensureUrl(input: string): string {
  try {
    const u = new URL(input);
    return u.toString();
  } catch {
    // assume hostname, default to https
    return `https://${input}`;
  }
}

async function requestHeaders(url: string, method: 'HEAD'|'GET', extra: any = {}): Promise<AxiosResponse<any>> {
  // Prefer HEAD to avoid body; fall back to GET if HEAD not allowed
  return axios.request({
    url,
    method,
    maxRedirects: 5,
    timeout: 15000,
    validateStatus: () => true, // we want headers even on 4xx/5xx
    headers: {
      'User-Agent':
        process.env.SECURITY_UA ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    ...extra,
  });
}

function looksLikeJWT(value: string): boolean {
  // very rough check for three base64url parts separated by dots
  return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value.trim());
}

function analyzeHeaders(finalUrl: string, headers: Record<string, string>, cookies: CookieInfo[]): { findings: SecurityFinding[]; checks: SecurityReport['checks']; score: number } {
  let score = 100;
  const findings: SecurityFinding[] = [];
  const checks: SecurityReport['checks'] = {};

  const h = (k: string) => headers[k.toLowerCase()];
  const has = (k: string) => !!h(k);
  const https = finalUrl.startsWith('https://');

  // CSP
  const csp = h('content-security-policy');
  if (!csp) {
    findings.push({ id: 'csp.missing', title: 'Falta Content-Security-Policy', severity: 'critical', recommendation: 'Define un encabezado Content-Security-Policy estricto para mitigar XSS y carga de recursos no confiables.', scoreImpact: -30 });
    score -= 30;
    checks['csp'] = { ok: false, notes: 'missing' };
  } else {
    let impact = 0;
    const hasUnsafeInline = /'unsafe-inline'/i.test(csp);
    const hasUnsafeEval = /'unsafe-eval'/i.test(csp);
    const hasNonceOrHash = /(nonce-|sha(256|384|512)-)/i.test(csp);
    const hasUpgrade = /upgrade-insecure-requests/i.test(csp);
    const hasBlockMixed = /block-all-mixed-content/i.test(csp);

    if (hasUnsafeInline) { impact -= 10; findings.push({ id: 'csp.unsafe-inline', title: 'CSP permite unsafe-inline', severity: 'warning', recommendation: "Evita 'unsafe-inline'. Usa nonces o hashes para scripts/estilos inline.", scoreImpact: -10 }); }
    if (hasUnsafeEval) { impact -= 5; findings.push({ id: 'csp.unsafe-eval', title: 'CSP permite unsafe-eval', severity: 'warning', recommendation: "Evita 'unsafe-eval'.", scoreImpact: -5 }); }
    if (!hasNonceOrHash) { impact -= 5; findings.push({ id: 'csp.no-nonce-hash', title: 'CSP sin nonce/hash', severity: 'info', recommendation: 'Usa nonces o hashes para scripts/estilos inline.', scoreImpact: -5 }); }

    // Frame-ancestors validation
    const faMatch = csp.match(/frame-ancestors\s+([^;]+)/i);
    const faVal = faMatch ? faMatch[1].trim() : '';
    if (!faVal) {
      findings.push({
        id: 'csp.no-frame-ancestors',
        title: 'CSP sin frame-ancestors',
        severity: 'warning',
        recommendation: "Incluye 'frame-ancestors \\u0027none\\u0027' o 'same-origin' o lista explícita.",
        scoreImpact: -4
      });
      score -= 4;
    } else if (/\*/.test(faVal) || /https?:\s*\*/i.test(faVal)) {
      findings.push({
        id: 'csp.frame-ancestors.weak',
        title: 'frame-ancestors permisivo',
        severity: 'warning',
        recommendation: 'Restringe frame-ancestors a none/same-origin o dominios específicos.',
        scoreImpact: -4
      });
      score -= 4;
    }

    score += impact;
    checks['csp'] = { ok: true, notes: `upgrade:${hasUpgrade}, block-mixed:${hasBlockMixed}, nonce/hash:${hasNonceOrHash}, frame-ancestors:${faVal || 'missing'}` };
  }

  // HSTS
  const sts = h('strict-transport-security');
  let includeSD = false;
  let maxAge = 0;
  let body = ''; // Initialize body variable for SRI analysis

  if (https) {
    const sts = h('strict-transport-security');
    if (sts) {
      includeSD = /includesubdomains/i.test(sts);
      const maxAgeMatch = sts.match(/max-age=(\d+)/i);
      maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
    }
  }

  if (https) {
    if (!sts) {
      findings.push({ id: 'hsts.missing', title: 'Falta Strict-Transport-Security (HSTS)', severity: 'critical', recommendation: 'Agrega HSTS con max-age >= 15552000, includeSubDomains, preload.', scoreImpact: -20 });
      score -= 20;
      checks['hsts'] = { ok: false, notes: 'missing' };
    } else {
      const preload = /preload/i.test(sts);
      if (maxAge < 15552000) { // <180 días
        findings.push({ id: 'hsts.low-max-age', title: 'HSTS max-age bajo', severity: 'warning', recommendation: 'Usa max-age >= 15552000 (ideal 31536000).', scoreImpact: -10 });
        score -= 10;
      }
      if (!includeSD) {
        findings.push({ id: 'hsts.no-include-subdomains', title: 'HSTS sin includeSubDomains', severity: 'info', recommendation: 'Incluye includeSubDomains en HSTS.', scoreImpact: -2 });
        score -= 2;
      }
      if (!preload) {
        findings.push({ id: 'hsts.no-preload', title: 'HSTS sin preload', severity: 'info', recommendation: 'Considera habilitar preload tras validar no romper subdominios.', scoreImpact: -2 });
        score -= 2;
      } else if (preload && (!includeSD || maxAge < 31536000)) {
        findings.push({
          id: 'hsts.preload.prereq',
          title: 'Preload HSTS sin prerrequisitos',
          severity: 'warning',
          recommendation: 'Para ser elegible a preload: max-age >= 31536000 e includeSubDomains habilitado.',
          scoreImpact: -4
        });
        score -= 4;
      }
      checks['hsts'] = { ok: true, notes: `max-age:${maxAge}, includeSubDomains:${includeSD}, preload:${preload}` };
    }
  }

  // X-Content-Type-Options
  const xcto = h('x-content-type-options');
  if (!xcto || xcto.toLowerCase() !== 'nosniff') {
    findings.push({ id: 'xcto.missing', title: 'X-Content-Type-Options ausente o inválido', severity: 'warning', recommendation: "Establece 'X-Content-Type-Options: nosniff' para evitar MIME sniffing.", scoreImpact: -10 });
    score -= 10;
    checks['x-content-type-options'] = { ok: false };
  } else {
    checks['x-content-type-options'] = { ok: true };
  }

  // X-Frame-Options (legacy but useful)
  const xfo = h('x-frame-options');
  if (!xfo || !/(deny|sameorigin)/i.test(xfo)) {
    findings.push({ id: 'xfo.missing', title: 'X-Frame-Options ausente o débil', severity: 'warning', recommendation: "Usa 'DENY' o 'SAMEORIGIN' o una CSP frame-ancestors equivalente.", scoreImpact: -5 });
    score -= 5;
    checks['x-frame-options'] = { ok: false };
  } else {
    checks['x-frame-options'] = { ok: true, notes: xfo };
  }

  // Referrer-Policy
  const rp = h('referrer-policy');
  if (!rp) {
    findings.push({ id: 'referrer.missing', title: 'Referrer-Policy ausente', severity: 'info', recommendation: "Recomendado 'strict-origin-when-cross-origin' o 'no-referrer'.", scoreImpact: -5 });
    score -= 5;
    checks['referrer-policy'] = { ok: false };
  } else {
    const good = /(no-referrer|strict-origin-when-cross-origin)/i.test(rp);
    if (!good) {
      findings.push({ id: 'referrer.weak', title: 'Referrer-Policy débil', severity: 'info', recommendation: "Usa 'strict-origin-when-cross-origin' o 'no-referrer'.", scoreImpact: -2 });
      score -= 2;
    }
    checks['referrer-policy'] = { ok: true, notes: rp };
  }

  // Permissions-Policy
  const pp = h('permissions-policy') || h('feature-policy');
  if (!pp) {
    findings.push({ id: 'perm.missing', title: 'Permissions-Policy ausente', severity: 'info', recommendation: 'Agrega Permissions-Policy para restringir APIs (camera, geolocation, etc.).', scoreImpact: -5 });
    score -= 5;
    checks['permissions-policy'] = { ok: false };
  } else {
    checks['permissions-policy'] = { ok: true };
  }

  // COOP / COEP / CORP
  const coop = h('cross-origin-opener-policy');
  const coep = h('cross-origin-embedder-policy');
  const corp = h('cross-origin-resource-policy');
  if (!coop) {
    findings.push({
      id: 'coop.missing',
      title: 'COOP ausente',
      severity: 'info',
      recommendation: "Agrega 'Cross-Origin-Opener-Policy: same-origin' para aislar la página.",
      scoreImpact: -1
    });
    score -= 1;
  }
  if (!coep) {
    findings.push({
      id: 'coep.missing',
      title: 'COEP ausente',
      severity: 'info',
      recommendation: "Agrega 'Cross-Origin-Embedder-Policy: require-corp' si aplicable.",
      scoreImpact: -1
    });
    score -= 1;
  }
  if (!corp) {
    findings.push({
      id: 'corp.missing',
      title: 'CORP ausente',
      severity: 'info',
      recommendation: "Agrega 'Cross-Origin-Resource-Policy' (same-origin/same-site).",
      scoreImpact: -1
    });
    score -= 1;
  }

  const triad = [!!coop, !!coep, !!corp].filter(Boolean).length;
  if (triad > 0 && triad < 3) {
    findings.push({ id: 'isolation.triad.incomplete', title: 'Aislamiento COOP/COEP/CORP incompleto', severity: 'info', recommendation: 'Para máxima protección (y SharedArrayBuffer), configura las tres cabeceras: COOP: same-origin, COEP: require-corp y CORP: same-origin/same-site.' });
  }

  // HSTS preload nuances
  if (https && sts) {
    const preload = /preload/i.test(sts);
    if (preload && (!includeSD || maxAge < 31536000)) {
      findings.push({
        id: 'hsts.preload.prereq',
        title: 'Preload HSTS sin prerrequisitos',
        severity: 'warning',
        recommendation: 'Para ser elegible a preload: max-age >= 31536000 e includeSubDomains habilitado.',
        scoreImpact: -4
      });
      score -= 4;
    }
  }

  // SRI checks
  const sriFindings = analyzeBodyForSRI(body);
  findings.push(...sriFindings);

  // Expect-CT (historical)
  const expectCT = h('expect-ct');
  if (expectCT) {
    findings.push({
      id: 'expect-ct.present',
      title: 'Expect-CT presente (histórico)',
      severity: 'info',
      recommendation: 'Expect-CT está obsoleto; puedes retirarlo salvo requerimientos legacy.',
      details: expectCT
    });
  }

  // Enhanced cookie analysis
  if (cookies.length) {
    for (const c of cookies) {
      const nameLc = (c.name || '').toLowerCase();
      const sameLc = (c.sameSite || '').toString().toLowerCase();

      if (https && !c.secure) {
        findings.push({
          id: `cookie.${c.name}.no-secure`,
          title: `Cookie ${c.name} sin Secure`,
          severity: 'warning',
          recommendation: 'Marca la cookie como Secure cuando sirves por HTTPS.',
          scoreImpact: -5
        });
        score -= 5;
      }
      if (!c.httpOnly) {
        findings.push({
          id: `cookie.${c.name}.no-httponly`,
          title: `Cookie ${c.name} sin HttpOnly`,
          severity: 'warning',
          recommendation: 'Marca la cookie como HttpOnly para evitar acceso vía JS.',
          scoreImpact: -5
        });
        score -= 5;
      }
      if (!c.sameSite) {
        findings.push({
          id: `cookie.${c.name}.no-samesite`,
          title: `Cookie ${c.name} sin SameSite`,
          severity: 'info',
          recommendation: 'Configura SameSite (Lax/Strict) para mitigar CSRF.',
          scoreImpact: -3
        });
        score -= 3;
      }

      if (sameLc === 'none' && !c.secure) {
        findings.push({
          id: `cookie.${c.name}.samesite-none-insecure`,
          title: `Cookie ${c.name} SameSite=None sin Secure`,
          severity: 'critical',
          recommendation: "Las cookies con SameSite=None deben ser Secure (requisito del navegador).",
          scoreImpact: -10
        });
        score -= 10;
      }

      if (nameLc.match(/(session|auth|token|sid|jwt)/) && !c.httpOnly) {
        findings.push({
          id: `cookie.${c.name}.sensitive-no-httponly`,
          title: `Cookie sensible ${c.name} sin HttpOnly`,
          severity: 'critical',
          recommendation: 'Cookies de sesión/autenticación deben ser HttpOnly para mitigar XSS.',
          scoreImpact: -10
        });
        score -= 10;
      }

      if (looksLikeJWT(c.value) && !c.httpOnly) {
        findings.push({
          id: `cookie.${c.name}.jwt-in-cookie-readable`,
          title: `JWT en cookie legible por JS`,
          severity: 'critical',
          recommendation: 'Evita exponer JWT a JavaScript. Prefiere cookies HttpOnly o tokens en memoria con otras mitigaciones.',
          scoreImpact: -10
        });
        score -= 10;
      }

      if (c.domain && c.domain.startsWith('.')) {
        findings.push({
          id: `cookie.${c.name}.broad-domain`,
          title: `Cookie ${c.name} con dominio amplio (${c.domain})`,
          severity: 'info',
          recommendation: 'Restringe el dominio de la cookie cuando sea posible para reducir exposición entre subdominios.'
        });
      }

      if (c.path && c.path === '/') {
        findings.push({
          id: `cookie.${c.name}.path-root`,
          title: `Cookie ${c.name} con Path=/`,
          severity: 'info',
          recommendation: 'Restringe Path cuando sea posible para minimizar alcance.'
        });
      }
    }
  }
  checks['cookies'] = { ok: findings.filter(f => f.id.startsWith('cookie.')).length === 0 };

  // Boundaries
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { findings, checks, score };
}

async function checkHttpsRedirect(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const httpUrl = u.protocol === 'http:' ? url : `http://${u.host}${u.pathname}${u.search}`;
    const r = await requestHeaders(httpUrl, 'HEAD', { maxRedirects: 0 });
    const loc = (r.headers?.location || r.headers?.Location || '') as string;
    return r.status >= 300 && r.status < 400 && typeof loc === 'string' && loc.startsWith('https://');
  } catch {
    return false;
  }
}

function profileEnvironment(finalUrl: string, headers: Record<string, string>, body?: string | null): EnvironmentProfile {
  const ct = (headers['content-type'] || '').toLowerCase();
  const xpb = (headers['x-powered-by'] || '').toLowerCase();
  const server = (headers['server'] || '').toLowerCase();
  const evd: string[] = [];
  const rec: string[] = [];

  // API indicators
  if (/application\/json|application\/.+\+json/.test(ct)) {
    evd.push(`content-type:${ct}`);
    rec.push('Para APIs, aplica CORS estricto y valida esquemas/entradas.');
    return { kind: 'api', evidence: evd, recommendations: rec };
  }

  // HTML-like
  if (/text\/html/.test(ct)) {
    evd.push(`content-type:${ct}`);
    const html = typeof body === 'string' ? body : '';
    const isSPA = /<div[^>]+id=["']?(root|app)["']?/i.test(html) || /window\.__NUXT__|__NEXT_DATA__|vite|webpack/i.test(html);
    if (isSPA) {
      rec.push('Para SPA, refuerza CSP (sin unsafe-inline), usa nonces y segmenta orígenes.');
      return { kind: 'spa', evidence: evd, recommendations: rec };
    }
    // Could be static or SSR
    if (/vercel|next|nuxt/.test(xpb) || /vercel|cloudflare|nginx|apache/.test(server)) {
      rec.push('Asegura cabeceras estándar (HSTS, XCTO, RP, PP) y cacheo seguro.');
      return { kind: 'ssr', evidence: evd, recommendations: rec };
    }
    return { kind: 'static', evidence: evd, recommendations: rec };
  }

  // Fallbacks by headers
  if (xpb.includes('express')) {
    rec.push('Habilita helmet en Express y configura cabeceras recomendadas.');
  }
  if (server.includes('nginx') || server.includes('apache')) {
    rec.push('Revisa configuración de cabeceras seguras en el servidor web.');
  }
  return { kind: 'unknown', evidence: evd, recommendations: rec };
}

function analyzeBodyForSRI(body?: string | null): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  if (!body) return out;
  // naive scan for external scripts/styles without integrity attribute
  const scripts = Array.from(body.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi));
  for (const m of scripts) {
    const tag = m[0];
    const src = (m[1] || '').trim();
    const external = /^https?:\/\//i.test(src) && !/^["']?\//.test(src);
    const hasIntegrity = /\sintegrity\s*=\s*["'][^"']+["']/i.test(tag);
    if (external && !hasIntegrity) {
      out.push({ id: `sri.script.missing`, title: `Script externo sin SRI`, severity: 'info', recommendation: 'Para recursos terceros, agrega atributo integrity y crossorigin para activar Subresource Integrity.', details: { src } });
    }
  }
  const links = Array.from(body.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi));
  for (const m of links) {
    const tag = m[0];
    const href = (m[1] || '').trim();
    const external = /^https?:\/\//i.test(href) && !/^["']?\//.test(href);
    const hasIntegrity = /\sintegrity\s*=\s*["'][^"']+["']/i.test(tag);
    if (external && !hasIntegrity) {
      out.push({ id: `sri.style.missing`, title: `Hoja de estilo externa sin SRI`, severity: 'info', recommendation: 'Para CSS de terceros, agrega atributo integrity y crossorigin para activar Subresource Integrity.', details: { href } });
    }
  }
  return out;
}

export async function analyzeSecurity(inputUrl: string): Promise<SecurityReport> {
  const url = ensureUrl(inputUrl);
  // Try HEAD first
  let res: AxiosResponse<any> | null = null;
  let method: 'HEAD' | 'GET' = 'HEAD';
  try {
    res = await requestHeaders(url, 'HEAD');
    if (!res.headers || Object.keys(res.headers).length === 0) throw new Error('empty headers');
  } catch {
    method = 'GET';
    res = await requestHeaders(url, 'GET', { responseType: 'text' });
  }

  const headersMap = toHeaderMap(res!.headers);
  const setCookie = (res!.headers['set-cookie'] || res!.headers['Set-Cookie']) as any;
  const cookies = parseSetCookie(setCookie);

  // Attempt to read final URL from response/request
  let finalUrl = url;
  try {
    // axios in node (follow-redirects) may set these
    const anyReq: any = (res as any).request;
    finalUrl = anyReq?.res?.responseUrl || anyReq?.responseUrl || finalUrl;
  } catch {}

  const https = finalUrl.startsWith('https://');
  const httpsEnforced = await checkHttpsRedirect(url);

  const { findings, checks, score } = analyzeHeaders(finalUrl, headersMap, cookies);

  // Optional body analysis for SRI/environment if we fetched HTML
  const body: string | null = typeof (res as any)?.data === 'string' ? ((res as any).data as string) : null;
  const sriFindings = analyzeBodyForSRI(body);
  findings.push(...sriFindings);

  const environment = profileEnvironment(finalUrl, headersMap, body);

  const out: SecurityReport = {
    ok: true,
    meta: { source: 'custom', service: 'security-service', version: 2, generatedAt: new Date().toISOString() },
    inputUrl: url,
    finalUrl,
    method,
    status: res!.status,
    headers: headersMap,
    cookies,
    httpsEnforced,
    https,
    checks,
    score,
    grade: gradeFromScore(score),
    findings,
    environment,
  };
  return out;
}