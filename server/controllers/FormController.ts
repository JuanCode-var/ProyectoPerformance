// server/controllers/formController.ts
import type { Request, Response } from "express";
import axios from "axios";
import nodemailer from "nodemailer";
import type { SendMailOptions, SentMessageInfo } from "nodemailer";

// import { log } from "../utils/logger.js";
import Audit from "../database/esquemaBD.js";
import Security from "../database/securitySchema.js";
import TelemetryEvent from "../database/telemetryEvent.js";
import { readMetrics, extractOpportunities } from "../utils/lh.js";
import { hrTimer, hashUrl, emitTelemetry, categorizeError } from '../utils/telemetry.js';

// =====================
// Helpers/consts
// =====================
function withAudit(base?: string) {
  if (!base) return "/audit";
  const trimmed = String(base).replace(/\/+$/, "");
  return trimmed.endsWith("/audit") ? trimmed : `${trimmed}/audit`;
}

const ALL_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

const MS_PAGESPEED_URL = process.env.MS_PAGESPEED_URL || "http://localhost:3001";
const MS_SECURITY_URL = process.env.MS_SECURITY_URL || "http://localhost:3002";

// New: configurable timeouts and execution strategy
const PAGESPEED_TIMEOUT_MS = Number.parseInt(process.env.PAGESPEED_TIMEOUT_MS || "300000", 10);
const SECURITY_TIMEOUT_MS = Number.parseInt(process.env.SECURITY_TIMEOUT_MS || "120000", 10);
const RUN_MICROS_IN_SERIES = /^(1|true|yes)$/i.test(process.env.RUN_MICROS_IN_SERIES || "");
const SECURITY_RETRIES = Math.max(0, Number.parseInt(process.env.SECURITY_RETRIES || "2", 10));
const SECURITY_RETRY_BACKOFF_MS = Math.max(0, Number.parseInt(process.env.SECURITY_RETRY_BACKOFF_MS || "1000", 10));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSecurityError(err: any): boolean {
  const status: number | undefined = err?.response?.status;
  const code = (err?.code || err?.errno || "").toString();
  // Retry network/timeout/transient server errors
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ECONNRESET") return true;
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  // No response at all (network error)
  if (!err?.response) return true;
  return false;
}

async function callWithRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; backoffMs?: number; label?: string }) {
  const retries = Math.max(0, opts?.retries ?? SECURITY_RETRIES);
  const base = Math.max(0, opts?.backoffMs ?? SECURITY_RETRY_BACKOFF_MS);
  const label = opts?.label || "call";
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = base * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
        // eslint-disable-next-line no-console
        console.warn(`[Retry] ${label} intento ${attempt}/${retries} tras ${delay}ms`);
        await sleep(delay);
      }
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isRetryableSecurityError(err) || attempt === retries) {
        throw err;
      }
    }
  }
  throw lastErr;
}

// Llama al microservicio pagespeed y devuelve su payload tal cual
async function runPagespeedViaMicro(url: string, strategy: "mobile" | "desktop") {
  const endpoint = withAudit(MS_PAGESPEED_URL);
  // mantenemos compat: pedimos SIEMPRE todas las categorías
  const payload = { url, strategy, categories: [...ALL_CATEGORIES] };
  const { data } = await axios.post(endpoint, payload, { timeout: PAGESPEED_TIMEOUT_MS });
  return data; // ← lo que tu micro ya devuelve (incluye raw, metrics, categoryScores, etc.)
}

// Detecta el form factor real desde el LHR almacenado
function detectFormFactorFromDoc(doc: any): "mobile" | "desktop" | undefined {
  try {
    const lhr =
      doc?.audit?.pagespeed?.raw?.lighthouseResult ||
      doc?.audit?.pagespeed?.lighthouseResult ||
      null;
    const cfg = lhr?.configSettings || {};
    const emu = cfg.emulatedFormFactor ?? cfg.formFactor;
    if (emu === "mobile" || emu === "desktop") return emu;
    if (cfg?.screenEmulation && typeof cfg.screenEmulation.mobile === "boolean") {
      return cfg.screenEmulation.mobile ? "mobile" : "desktop";
    }
  } catch {}
  return doc?.strategy === "desktop" ? "desktop" : doc?.strategy === "mobile" ? "mobile" : undefined;
}

// Resuelve performance (misma lógica que ya usabas al guardar)
function resolvePerformanceFromPagespeed(ps: any): number | null {
  const catScores = ps?.categoryScores || {};
  if (typeof catScores?.performance === "number" && !Number.isNaN(catScores.performance))
    return Math.round(catScores.performance);
  if (typeof ps?.performance === "number" && !Number.isNaN(ps.performance))
    return Math.round(ps.performance);
  const rawScore = ps?.raw?.lighthouseResult?.categories?.performance?.score;
  return typeof rawScore === "number" ? Math.round(rawScore * 100) : null;
}

// =====================
// -------- Ping/Info --------
export async function auditPing(_req: Request, res: Response) {
  return res.json({
    ok: true,
    message: "Audit API ready",
    endpoints: [
      "POST /api/audit",
      "GET  /api/audit/:id",
      "GET  /api/audit/history?url=...",
      "GET  /api/audit/by-url?url=...&strategy=...",
      "GET  /api/diagnostics/:rawUrl/audit?strategy=...",
      "POST /api/audit/send-diagnostic",
      "POST /api/audit/send-report",
    ],
  });
}

// -------- Crear auditoría --------
export async function guardarDatos(req: Request, res: Response) {
  const diagStop = hrTimer();
  const diagId = crypto.randomUUID().slice(0,8);
  const userCtx = { userId: req.user?._id || null, role: req.user?.role || (req as any)?.user?.role || null };
  let microsRun: string[] = [];
  const fail = (status: number, msg: string, extra: Record<string, unknown> = {}) =>
    res.status(status).json({ ok: false, error: msg, ...extra });

  try {
    const { url, type = "pagespeed", strategy = "mobile", name, email, nocache } = (req.body || {}) as any;
    if (!url || !/^https?:\/\//i.test(url)) return fail(400, "URL inválida");
    const urlHash = hashUrl(url);
    // tipos se define después de validar type, por eso lo reconstruimos luego en start
    // Emitiremos start después de conocer "tipos"

    const MICROSERVICES: Record<"pagespeed" | "security", { endpoint: string }> = {
      pagespeed: { endpoint: withAudit(MS_PAGESPEED_URL) },
      security: { endpoint: MS_SECURITY_URL },
    };

    const tipos = Array.isArray(type)
      ? (type as string[])
      : type === "all"
      ? (Object.keys(MICROSERVICES) as Array<keyof typeof MICROSERVICES>)
      : [type];

    await emitTelemetry('diagnostic.start', { diagId, ...userCtx, urlHash, urlSample: url, domain: (()=>{ try { return new URL(url).hostname; } catch { return null; } })(), strategy, tipos });

    const invalid = tipos.filter((t) => !(t in MICROSERVICES));
    if (invalid.length) return fail(400, `Tipo(s) inválido(s): ${invalid.join(", ")}`);

    // Cache 1h
    try {
      const CACHE_TTL = 1000 * 60 * 60;
      const cutoff = new Date(Date.now() - CACHE_TTL);
      // Asegurar que para clientes el cache solo devuelva documentos del mismo usuario
      const cachedQuery: any = {
        url,
        tipos,
        strategy,
        fecha: { $gte: cutoff },
      };
      if ((req as any)?.user?.role === 'cliente' && (req as any)?.user?._id) {
        cachedQuery.userId = (req as any).user._id;
      }
      const cached = await Audit.findOne(cachedQuery);
      if (!nocache && cached) {
        const resp: any = cached.toObject();
        // En lugar de devolver el cache directamente, registramos un nuevo documento para histórico
        try {
          const ownerId = (req as any)?.user?._id || (req as any)?.user?.id || undefined;
          const typeVal = Array.isArray(resp?.tipos) && resp.tipos.length ? resp.tipos[0] : (resp?.type || (Array.isArray(tipos) ? (tipos as string[])[0] : String(type)));
          const metricsVal = resp?.metrics ?? resp?.audit?.pagespeed?.metrics ?? undefined;
          const perfVal = typeof resp?.performance === 'number' ? resp.performance : (
            typeof resp?.audit?.pagespeed?.performance === 'number' ? Math.round(resp.audit.pagespeed.performance) : undefined
          );

          // Marca en el metadato que proviene de caché para trazabilidad
          const auditClone = resp?.audit ? JSON.parse(JSON.stringify(resp.audit)) : {};
          try {
            if (auditClone?.pagespeed?.meta) {
              auditClone.pagespeed.meta.cacheClone = true;
              auditClone.pagespeed.meta.clonedAt = new Date().toISOString();
            }
          } catch {}

          const newDoc = await Audit.create({
            url,
            type: typeVal,
            tipos: Array.isArray(resp?.tipos) ? resp.tipos : Array.isArray(tipos) ? tipos as string[] : [String(typeVal)],
            name: (req as any)?.user?.name || resp?.name,
            email: (req as any)?.user?.email || resp?.email,
            userId: ownerId ?? resp?.userId ?? undefined,
            strategy,
            audit: auditClone || resp?.audit || undefined,
            performance: perfVal,
            metrics: metricsVal,
            security: resp?.security ?? undefined,
            fecha: new Date(),
          });

          const out: any = newDoc.toObject();
          out.ok = true;
          out.isLocal = out?.audit?.pagespeed?.meta?.source === 'local';
          return res.status(201).json(out);
        } catch (cloneErr: any) {
          console.warn('⚠️ Cache clone falló, devolviendo cache existente:', cloneErr?.message);
          const respOut: any = { ...resp, ok: true };
          respOut.isLocal = resp?.audit?.pagespeed?.meta?.source === 'local';
          return res.json(respOut);
        }
      }
    } catch (e: any) {
      console.warn("⚠️ Cache lookup falló:", e?.message); // eslint-disable-line no-console
    }

    // Llamadas a microservicios
    const serviceCall = async (t: "pagespeed" | "security") => {
      const stop = hrTimer();
      let success = false; let status: number | null = null; let retriesUsed: number | null = null;
      try {
        if (t === "pagespeed") {
          const r = await axios.post(
            MICROSERVICES.pagespeed.endpoint,
            { url, strategy: strategy as string, categories: [...ALL_CATEGORIES] },
            { timeout: PAGESPEED_TIMEOUT_MS }
          );
          success = true; status = r.status;
          return { [t]: r.data } as Record<string, unknown>;
        }
        const base = String(MICROSERVICES.security.endpoint || "").replace(/\/+$/, "");
        const endpoint = /\/api\//.test(base) ? base : `${base}/api/analyze`;
        console.log(`[security] calling micro → ${endpoint}`);
        const http = await import('http');
        const https = await import('https');
        const httpAgent = new (http as any).Agent({ keepAlive: true });
        const httpsAgent = new (https as any).Agent({ keepAlive: true });
        let attempt = 0;
        const r = await callWithRetry(
          async () => { attempt++; return axios.post(endpoint, { url }, { timeout: SECURITY_TIMEOUT_MS, httpAgent, httpsAgent, proxy: false }); },
          { label: "security analyze", retries: SECURITY_RETRIES, backoffMs: SECURITY_RETRY_BACKOFF_MS }
        );
        success = true; status = (r as any).status; retriesUsed = attempt - 1;
        return { [t]: (r as any).data };
      } catch (err: any) {
        status = err?.response?.status ?? null;
        const cat = categorizeError(err);
        emitTelemetry('diagnostic.micro_call', { diagId, ...userCtx, micro: t, urlHash, status, success: false, durationMs: stop(), retries: retriesUsed, errorCategory: cat });
        return { [t]: { error: err?.message || 'error', status } } as Record<string, unknown>;
      } finally {
        if (success) emitTelemetry('diagnostic.micro_call', { diagId, ...userCtx, micro: t, urlHash, status, success: true, durationMs: stop(), retries: retriesUsed });
        microsRun.push(t);
      }
    };

    // Ejecutar en paralelo o en serie según configuración
    const tiposNormalized = (tipos as Array<"pagespeed" | "security">).filter((t): t is "pagespeed" | "security" => t === "pagespeed" || t === "security");
    const shouldRunInSeries = RUN_MICROS_IN_SERIES && tiposNormalized.length > 1 && tiposNormalized.includes("security");

    let partials: Record<string, any>[] = [];
    if (shouldRunInSeries) {
      console.log("[INFO] Ejecutando microservicios en serie por configuración RUN_MICROS_IN_SERIES=true");
      for (const t of tiposNormalized) {
        const part = await serviceCall(t);
        partials.push(part);
      }
    } else {
      partials = await Promise.all(tiposNormalized.map(serviceCall));
    }

    const audit = partials.reduce<Record<string, any>>((acc, cur) => ({ ...acc, ...cur }), {});

    const allFailed = (tipos as string[]).every((t) => audit[t] && audit[t].error);
    if (allFailed) return fail(502, "Ningún microservicio respondió correctamente", { details: audit });

    const onlyPagespeedOk = tiposNormalized.length === 1 && audit.pagespeed && !audit.pagespeed.error;

    // Resolver performance (top-level)
    const perfResolved = onlyPagespeedOk ? resolvePerformanceFromPagespeed(audit.pagespeed) : undefined;

    // Guardar en DB
    try {
      const doc = await Audit.create({
        url,
        type: (tipos as string[])[0],
        tipos,
        name: req.user?.name || name,
        email: req.user?.email || email,
        userId: req.user?._id ? (req as any).user._id : (req as any)?.user?.id || undefined,
        strategy,
        audit,
        performance: onlyPagespeedOk ? perfResolved : undefined,
        metrics: onlyPagespeedOk ? audit.pagespeed?.metrics : undefined,
        security: tipos.includes("security") ? audit.security : undefined,
        fecha: new Date(),
      });

      // Si hay seguridad, guardarla en su colección dedicada (sin bloquear el flujo)
      if (tipos.includes("security") && audit.security && !audit.security.error) {
        try {
          await Security.create({
            url,
            score: audit.security.score ?? null,
            grade: audit.security.grade ?? null,
            findings: audit.security.findings ?? [],
            checks: audit.security.checks ?? [],
            meta: audit.security.meta ?? {},
            fecha: new Date(),
          });
          console.log("✅ Datos de seguridad guardados en la colección 'security'");
        } catch (e: any) {
          console.error("❌ Error guardando datos de seguridad:", e?.message);
        }
      }

      const docObj: any = doc.toObject();
      docObj.ok = true;
      docObj.isLocal = docObj?.audit?.pagespeed?.meta?.source === "local";
      return res.status(201).json(docObj);
    } catch (e: any) {
      console.error("❌ Error guardando en DB:", e?.message); // eslint-disable-line no-console

      // Intento no-bloqueante de guardar seguridad en su colección incluso si el doc principal falla
      if (tipos.includes("security") && audit.security && !audit.security.error) {
        try {
          await Security.create({
            url,
            score: audit.security.score ?? null,
            grade: audit.security.grade ?? null,
            findings: audit.security.findings ?? [],
            checks: audit.security.checks ?? [],
            meta: audit.security.meta ?? {},
            fecha: new Date(),
          });
          console.log("✅ Datos de seguridad guardados en la colección 'security' (fallback)");
        } catch (se: any) {
          console.error("❌ Error guardando datos de seguridad (fallback):", se?.message);
        }
      }
      return fail(500, "No se pudo guardar el diagnóstico");
    }
  } catch (e: any) {
    console.error("❌ Error inesperado en guardarDatos:", e?.message);
    return fail(500, e?.message || "Error interno");
  } finally {
    // Reunir breakdown de micro_call desde TelemetryEvent podría requerir query; aquí sólo total.
    // Para primera iteración almacenamos total; breakdown se calcula en endpoint summary vía agregación de micro_call.
    emitTelemetry('diagnostic.end', { diagId, ...userCtx, urlHash: (()=>{ try { return hashUrl((req.body as any)?.url); } catch { return null; } })(), urlSample: (req.body as any)?.url, micros: microsRun, durationMs: diagStop() });
  }
}

// -------- Obtener auditoría por ID (con fallback por estrategia) --------
export async function getAuditById(req: Request, res: Response) {
  try {
    const id = (req.params?.id || "").trim();

    // Manejo de IDs temporales
    if (id.startsWith("temp_")) {
      console.warn("⚠️ Se recibió un ID temporal:", id);
      return res.status(400).json({
        error: "ID temporal no válido para consulta",
        detail: "El ID proporcionado es temporal y no está persistido en la base de datos."
      });
    }

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) return res.status(400).json({ error: "ID inválido" });

    // estrategia solicitada por el front (default: mobile)
    const strategy = (String(req.query?.strategy || "mobile") as "mobile" | "desktop");

    const doc = await Audit.findById(id);
    if (!doc) return res.status(404).json({ error: "No encontrado" });

    // 🔒 Clientes solo pueden ver sus propios diagnósticos
    if (req.user?.role === 'cliente') {
      const owner = (doc as any).userId ? String((doc as any).userId) : null;
      const uid = (req as any)?.user?._id || (req as any)?.user?.id || req.user._id;
      if (!owner || owner !== String(uid)) {
        return res.status(403).json({ error: 'Sin permisos' });
      }
    }

    const docObj: any = doc.toObject();
    docObj.ok = true;
    docObj.isLocal = docObj?.audit?.pagespeed?.meta?.source === "local";

    // Si lo guardado no coincide con lo solicitado, forzamos un run por URL+strategy
    const storedFF = detectFormFactorFromDoc(docObj);
    const same = storedFF ? storedFF === strategy : (docObj.strategy === strategy);

    if (!same && docObj.url) {
      try {
        const ps = await runPagespeedViaMicro(docObj.url, strategy);
        const perfResolved = resolvePerformanceFromPagespeed(ps);
        const out = {
          ok: true,
          url: docObj.url,
          name: docObj.name,
          email: docObj.email,
          strategy,
          // Mantener seguridad previamente almacenada para no perderla en la UI
          audit: {
            pagespeed: ps,
            security: docObj?.audit?.security ?? docObj?.security ?? undefined,
          },
          performance: perfResolved ?? undefined,
          metrics: ps?.metrics ?? undefined,
          fecha: new Date().toISOString(),
          forced: true,
          note: "Resultado forzado por estrategia solicitada",
        } as any;
        return res.json(out);
      } catch (e: any) {
        // Si algo falla, devolvemos lo guardado para no romper el front
        console.warn("⚠️ Fallback pagespeed by URL falló:", e?.message);
        return res.json(docObj);
      }
    }

    return res.json(docObj);
  } catch (e: any) {
    console.error("❌ Error en getAuditById:", e); // eslint-disable-line no-console
    return res.status(500).json({ error: "Error interno" });
  }
}

// -------- Historial por URL --------
export async function getAuditHistory(req: Request, res: Response) {
  try {
    const rawParam = (req.query?.url ?? "").toString().trim();
    if (!rawParam) return res.status(400).json({ error: "Falta el parámetro url" });

    let decoded = rawParam;
    try { decoded = decodeURIComponent(rawParam); } catch {}

    const stripHash = (u: string) => u.split("#")[0];
    const stripQuery = (u: string) => u.split("?")[0];
    const stripSlash = (u: string) => (u.endsWith("/") ? u.slice(0, -1) : u);
    const base = stripSlash(stripQuery(stripHash(decoded)));

    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rxBase = new RegExp("^" + esc(base) + "/?$", "i");

    const filter: any = {
      $or: [{ url: decoded }, { url: base }, { url: base + "/" }, { url: { $regex: rxBase } }],
    };

    // 🔒 Clientes: restringir a sus propios diagnósticos
    if (req.user?.role === 'cliente') {
      filter.userId = req.user._id;
    }

    const docs = await Audit.find(filter).sort({ fecha: 1 }).lean();

    const out = (docs || []).map((o: any) => {
      let perf =
        typeof o.performance === "number" && !Number.isNaN(o.performance)
          ? Math.round(o.performance)
          : null;

      if (perf == null && typeof o.audit?.pagespeed?.performance === "number") {
        perf = Math.round(o.audit.pagespeed.performance);
      }
      if (perf == null) {
        const score =
          o.audit?.pagespeed?.raw?.lighthouseResult?.categories?.performance?.score;
        if (typeof score === "number") perf = Math.round(score * 100);
      }

      const pick = (key: string) => {
        const v =
          o.metrics?.[key] ??
          o.audit?.pagespeed?.metrics?.[key] ??
          o.audit?.unlighthouse?.metrics?.[key] ??
          o.audit?.pagespeed?.[key] ??
          o.audit?.unlighthouse?.[key] ??
          null;
        return typeof v === "number" && !Number.isNaN(v) ? v : null;
      };

      return {
        _id: o._id,
        url: o.url,
        fecha: o.fecha,
        performance: perf,
        metrics: {
          lcp: pick("lcp"),
          fcp: pick("fcp"),
          tbt: pick("tbt"),
          si: pick("si"),
          ttfb: pick("ttfb"),
        },
        audit: o.audit,
        email: o.email,
        strategy: o.strategy,
        type: o.type,
        tipos: o.tipos,
      };
    });

    return res.json(out);
  } catch (e: any) {
    console.error("❌ getAuditHistory error:", e); // eslint-disable-line no-console
    return res.status(200).json([]); // degradar a vacío para no romper el front
  }
}

// -------- (NUEVO) Obtener auditoría por URL + strategy --------
// - Usado por el front como fallback cuando el doc por ID no coincide en estrategia
export async function getAuditByUrl(req: Request, res: Response) {
  try {
    const rawUrl = String(req.query?.url || "").trim();
    if (!rawUrl) return res.status(400).json({ error: "Falta parámetro url" });
    const strategy = (String(req.query?.strategy || "mobile") as "mobile" | "desktop");

    const url = (() => { try { return decodeURIComponent(rawUrl); } catch { return rawUrl; } })();

    const ps = await runPagespeedViaMicro(url, strategy);
    const perfResolved = resolvePerformanceFromPagespeed(ps);

    const out = {
      ok: true,
      url,
      strategy,
      audit: { pagespeed: ps },
      performance: perfResolved ?? undefined,
      metrics: ps?.metrics ?? undefined,
      fecha: new Date().toISOString(),
      forced: true,
      note: "Generado por /api/audit/by-url",
    };
    return res.json(out);
  } catch (e: any) {
    console.error("❌ getAuditByUrl error:", e);
    return res.status(500).json({ error: "Error interno", detail: e?.message });
  }
}

// -------- (NUEVO) Obtener auditoría por :rawUrl + strategy --------
// - Variante con :param que encaja perfecto con el fetch del front
export async function getDiagnosticsAudit(req: Request, res: Response) {
  try {
    const rawUrl = (req.params?.rawUrl || "").trim();
    if (!rawUrl) return res.status(400).json({ error: "Falta parámetro :rawUrl" });
    const strategy = (String(req.query?.strategy || "mobile") as "mobile" | "desktop");

    const url = (() => { try { return decodeURIComponent(rawUrl); } catch { return rawUrl; } })();

    const ps = await runPagespeedViaMicro(url, strategy);
    const perfResolved = resolvePerformanceFromPagespeed(ps);

    const out = {
      ok: true,
      url,
      strategy,
      audit: { pagespeed: ps },
      performance: perfResolved ?? undefined,
      metrics: ps?.metrics ?? undefined,
      fecha: new Date().toISOString(),
      forced: true,
      note: "Generado por /api/diagnostics/:rawUrl/audit",
    };
    return res.json(out);
  } catch (e: any) {
    console.error("❌ getDiagnosticsAudit error:", e);
    return res.status(500).json({ error: "Error interno", detail: e?.message });
  }
}

// -------- Enviar histórico por email --------
export async function sendReport(req: Request, res: Response) {
  const sendStop = hrTimer();
  const userCtx = { userId: req.user?._id || null, role: req.user?.role || null };
  let urlHash: string | null = null;
  try {
    const { url, email } = (req.body || {}) as { url?: string; email?: string };
    if (!url || !email) return res.status(400).json({ error: "Falta parámetro url o email" });
    urlHash = hashUrl(url);

    const query: any = { url };
    // 🔒 Clientes: solo pueden enviar histórico de sus propios diagnósticos
    if (req.user?.role === 'cliente') {
      query.userId = req.user._id;
    }

    const docs = await Audit.find(query).sort({ fecha: 1 });
    if (!docs.length) return res.status(404).json({ error: "No hay datos previos para esa URL" });

    const toSec1 = (ms: number | null | undefined) =>
      typeof ms === "number" && !Number.isNaN(ms)
        ? `${(Math.round((ms / 1000) * 10) / 10).toFixed(1)}s`
        : "N/A";

    const readMs = (doc: any, key: "fcp" | "lcp" | "tbt" | "si" | "ttfb") => {
      const p = doc?.audit?.pagespeed || {};
      const u = doc?.audit?.unlighthouse || {};

      if (doc?.metrics && typeof doc.metrics[key] === "number") return doc.metrics[key];
      if (p?.metrics && typeof p.metrics[key] === "number") return p.metrics[key];
      if (u?.metrics && typeof u.metrics[key] === "number") return u.metrics[key];
      if (typeof p[key] === "number") return p[key];
      if (typeof u[key] === "number") return u[key];

      const idMap: Record<typeof key, string> = {
        fcp: "first-contentful-paint",
        lcp: "largest-contentful-paint",
        tbt: "total-blocking-time",
        si: "speed-index",
        ttfb: "server-response-time",
      };
      const lhr = p?.raw?.lighthouseResult;
      const id = idMap[key];
      const nv = lhr?.audits?.[id]?.numericValue;
      return typeof nv === "number" ? nv : null;
    };

    const readPerf = (doc: any) => {
      if (typeof doc?.performance === "number" && !Number.isNaN(doc.performance))
        return Math.round(doc.performance);
      const p = doc?.audit?.pagespeed || {};
      if (typeof p.performance === "number") return Math.round(p.performance);
      const score = p?.raw?.lighthouseResult?.categories?.performance?.score;
      if (typeof score === "number") return Math.round(score * 100);
      return "N/A";
    };

    const rowsHtml = docs
      .map((doc: any, i: number) => {
        const fecha = new Date(doc.fecha).toLocaleString();
        const perf = readPerf(doc);

        const lcp = toSec1(readMs(doc, "lcp"));
        const fcp = toSec1(readMs(doc, "fcp"));
        const tbt = toSec1(readMs(doc, "tbt"));
        const si = toSec1(readMs(doc, "si"));
        const ttfb = toSec1(readMs(doc, "ttfb"));

        const bg = i % 2 === 0 ? "#f9fafb" : "#ffffff";
        return `
        <tr style="background:${bg}">
          <td style="padding:8px;border:1px solid #ddd">${fecha}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${perf}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${lcp}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${fcp}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${tbt}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${si}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${ttfb}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#333">
        <h2 style="text-align:center;color:#2563EB">
          Informe Histórico de <a href="${url}" style="color:#2563EB;text-decoration:underline">${url}</a>
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#2563EB;color:#fff">
              <th style="padding:12px;border:1px solid #ddd">Fecha / Hora</th>
              <th style="padding:12px;border:1px solid #ddd">Perf.</th>
              <th style="padding:12px;border:1px solid #ddd">LCP</th>
              <th style="padding:12px;border:1px solid #ddd">FCP</th>
              <th style="padding:12px;border:1px solid #ddd">TBT</th>
              <th style="padding:12px;border:1px solid #ddd">SI</th>
              <th style="padding:12px;border:1px solid #ddd">TTFB</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="text-align:right;font-size:0.85em;margin-top:24px;color:#666">
          Generado el ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER as string, pass: process.env.EMAIL_PASS as string },
    });

    const mailOptions: SendMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Informe Histórico de ${url}`,
      html,
    };

    const info: SentMessageInfo = await transporter.sendMail(mailOptions);
    emitTelemetry('email.sent', { ...userCtx, emailType: 'history', durationMs: sendStop(), success: true, urlHash });
    return res.status(200).json({ message: "Informe enviado correctamente", messageId: info.messageId });
  } catch (err: any) {
    emitTelemetry('email.sent', { ...userCtx, emailType: 'history', durationMs: sendStop(), success: false, urlHash, error: err?.message });
    console.error("❌ Error al enviar el informe:", err); // eslint-disable-line no-console
    return res.status(500).json({ error: "Error al enviar el informe", detail: err.message });
  }
}

// -------- Enviar diagnóstico individual --------
export async function sendDiagnostic(req: Request, res: Response) {
  const sendStop = hrTimer();
  const userCtx = { userId: req.user?._id || null, role: req.user?.role || null };
  let pdfSizeKb: number | null = null; let hasPdf = false; let urlHash: string | null = null;
  try {
    const { id, url, email, subject, pdf } = (req.body || {}) as {
      id?: string;
      url?: string;
      email?: string;
      subject?: string;
      pdf?: { base64?: string; filename?: string; contentType?: string } | null;
    };

    if (!id && !url) return res.status(400).json({ error: "Falta id o url" });

    let doc: any = null;
    if (id) {
      doc = await Audit.findById(id).lean();
      if (!doc) return res.status(404).json({ error: "No hay diagnóstico para ese criterio" });
      // 🔒 Clientes solo pueden enviar diagnósticos propios
      if (req.user?.role === 'cliente') {
        const owner = doc?.userId ? String(doc.userId) : null;
        if (!owner || owner !== req.user._id) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
      }
    } else {
      const q: any = { url };
      if (req.user?.role === 'cliente') q.userId = req.user._id;
      doc = await Audit.findOne(q).sort({ fecha: -1 }).lean();
      if (!doc) return res.status(404).json({ error: "No hay diagnóstico para ese criterio" });
    }

    // Calcular hash url para telemetría (siempre que tengamos doc.url)
    try { urlHash = doc?.url ? hashUrl(doc.url) : (url ? hashUrl(url) : null); } catch {}

    let toEmail = (email || doc.email || "").trim();
    if (!toEmail) return res.status(400).json({ error: "No hay email disponible" });

    const metrics = readMetrics(doc);
    const opps = extractOpportunities(doc).slice(0, 10);

    const pct = (v: number | null | undefined) => (v == null ? "N/A" : `${Math.round(v)}%`);
    const fmtS = (s: number | null | undefined) => (s == null ? "N/A" : `${Number(s).toFixed(2)}s`);
    const fmtMs = (ms: number | null | undefined) => (ms == null ? "N/A" : `${Math.round(ms)}ms`);

    const kpi = (label: string, val: string) =>
      `<div style="flex:1;min-width:120px;border:1px solid #E5E7EB;border-radius:12px;padding:12px;text-align:center">
         <div style="font-size:12px;color:#6B7280">${label}</div>
         <div style="font-size:20px;font-weight:700;color:#111827;margin-top:4px">${val}</div>
       </div>`;

    const fecha = new Date(doc.fecha).toLocaleString();
    const title = subject || `Diagnóstico de ${doc.url}`;

    const oppLi = opps
      .map((o) => {
        const s = o.savingsLabel ? ` · Ahorro: ${o.savingsLabel}` : "";
        const r = o.recommendation ? `<div style="color:#374151;margin-top:4px">${o.recommendation}</div>` : "";
        return `<li style="margin:0 0 10px 0"><div style="font-weight:600;color:#111827">${o.title || o.id}${s}</div>${r}</li>`;
      })
      .join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.45">
        <h2 style="text-align:center;color:#2563EB;margin:0 0 4px 0">${title}</h2>
        <div style="text-align:center;font-size:12px;color:#6B7280">Generado: ${fecha} · Estrategia: ${doc.strategy || "mobile"}</div>
        <div style="text-align:center;font-size:12px;color:#6B7280;margin-bottom:16px">Fuente: ${doc.audit?.pagespeed?.meta?.source || "desconocida"}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0">
          ${kpi("Performance", pct(metrics.performance))}
          ${kpi("FCP", fmtS(metrics.fcp))}
          ${kpi("LCP", fmtS(metrics.lcp))}
          ${kpi("TBT", fmtMs(metrics.tbt))}
          ${kpi("Speed Index", fmtS(metrics.si))}
          ${kpi("TTFB", fmtS(metrics.ttfb))}
        </div>
        <h3 style="margin:20px 0 8px;color:#111827">Plan de acción sugerido</h3>
        <div style="border:1px solid #E5E7EB;border-radius:12px;padding:12px">
          ${opps.length ? `<ul style="padding-left:18px;margin:0;list-style:disc;">${oppLi}</ul>` : `<p style="color:#374151;margin:0">No se detectaron oportunidades relevantes.</p>`}
        </div>
        <p style="text-align:right;font-size:12px;color:#6B7280;margin-top:24px">
          URL: <a href="${doc.url}" style="color:#2563EB">${doc.url}</a>
        </p>
      </div>
    `;

    // Procesar PDF si viene adjunto
    let attachments: any = undefined;
    if (pdf?.base64 && pdf?.filename) {
      try {
        const buf = Buffer.from(pdf.base64, 'base64');
        pdfSizeKb = Math.round(buf.length / 1024);
        hasPdf = true;
        attachments = [{ filename: pdf.filename, content: buf, contentType: pdf.contentType || 'application/pdf' }];
      } catch (e:any) {
        console.warn('⚠️ Error procesando PDF base64:', e?.message);
      }
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER as string, pass: process.env.EMAIL_PASS as string },
    });

    const mailOptions: SendMailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: title,
      html,
      attachments,
    };

    const info: SentMessageInfo = await transporter.sendMail(mailOptions);
    emitTelemetry('email.sent', { ...userCtx, emailType: 'diagnostic', hasPdf, pdfSizeKb, durationMs: sendStop(), urlHash, success: true });
    if (hasPdf) emitTelemetry('pdf.attached_to_email', { ...userCtx, pdfSizeKb, urlHash });
    return res.status(200).json({
      message: "Informe de diagnóstico enviado correctamente",
      messageId: info.messageId,
    });
  } catch (e: any) {
    emitTelemetry('email.sent', { ...userCtx, emailType: 'diagnostic', success: false, durationMs: sendStop(), urlHash, error: e?.message });
    console.error("❌ Error en sendDiagnostic:", e); // eslint-disable-line no-console
    return res.status(500).json({ error: "Error al enviar el diagnóstico", detail: e.message });
  }
}

// -------- Historial de Seguridad por URL --------
export async function getSecurityHistory(req: Request, res: Response) {
  try {
    const rawParam = (req.query?.url ?? "").toString().trim();
    if (!rawParam) return res.status(400).json({ error: "Falta el parámetro url" });

    let decoded = rawParam;
    try { decoded = decodeURIComponent(rawParam); } catch {}

    const stripHash = (u: string) => u.split("#")[0];
    const stripQuery = (u: string) => u.split("?")[0];
    const stripSlash = (u: string) => (u.endsWith("/") ? u.slice(0, -1) : u);
    const base = stripSlash(stripQuery(stripHash(decoded)));

    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rxBase = new RegExp("^" + esc(base) + "/?$", "i");

    const filter = {
      $or: [{ url: decoded }, { url: base }, { url: base + "/" }, { url: { $regex: rxBase } }],
    } as any;

    // Security es el modelo de la colección 'security'
    const rows = await (await import("../database/securitySchema.js")).default
      .find(filter)
      .sort({ fecha: 1 })
      .lean();

    const out = (rows || []).map((r: any) => {
      const findings = Array.isArray(r.findings) ? r.findings : [];
      const criticals = findings.filter((f: any) => f?.severity === "critical").length;
      const warnings = findings.filter((f: any) => f?.severity === "warning").length;
      const infos = findings.filter((f: any) => f?.severity === "info").length;
      return {
        _id: r._id,
        url: r.url,
        fecha: r.fecha,
        score: typeof r.score === "number" ? Math.round(r.score) : null,
        grade: r.grade || null,
        criticals,
        warnings,
        infos,
      };
    });

    return res.json(out);
  } catch (e: any) {
    console.error("❌ getSecurityHistory error:", e); // eslint-disable-line no-console
    return res.status(200).json([]);
  }
}

// =====================
// Helpers de normalización
// =====================
function normalizeUrlFromParam(rawParam: string) {
  let decoded = rawParam;
  try { decoded = decodeURIComponent(rawParam); } catch {}

  const stripHash  = (u: string) => u.split("#")[0];
  const stripQuery = (u: string) => u.split("?")[0];
  const stripSlash = (u: string) => (u.endsWith("/") ? u.slice(0, -1) : u);

  const base = stripSlash(stripQuery(stripHash(decoded)));

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Prefijo por base PERO permitiendo que después venga / ? # o fin de string
  const rxBase = new RegExp("^" + esc(base) + "(?:[/?#]|$)", "i");

  // Por si quieres matchear por ORIGEN (host) cuando cambia el path
  let origin = base;
  try { origin = new URL(base).origin; } catch {}
  const rxOrigin = new RegExp("^" + esc(origin) + "(?:[/?#]|$)", "i");

  return { decoded, base, rxBase, origin, rxOrigin, esc };
}

// Construye un filtro más rico: busca por url, por meta.finalUrl y por variantes
function buildDiagnosticsFilter(decoded: string, base: string, rxBase: RegExp, rxOrigin: RegExp) {
  return {
    $or: [
      { url: decoded },
      { url: base }, { url: base + "/" },
      { url: { $regex: rxBase } },
      { url: { $regex: rxOrigin } },

      { "audit.pagespeed.meta.finalUrl": decoded },
      { "audit.pagespeed.meta.finalUrl": { $regex: rxBase } },
      { "audit.pagespeed.meta.finalUrl": { $regex: rxOrigin } },

      { "audit.pagespeed.url": decoded },
      { "audit.pagespeed.url": { $regex: rxBase } },
      { "audit.pagespeed.url": { $regex: rxOrigin } },

      { "audit.unlighthouse.url": decoded },
      { "audit.unlighthouse.url": { $regex: rxBase } },
      { "audit.unlighthouse.url": { $regex: rxOrigin } },
    ]
  };
}

// =====================
// GET /api/diagnostics/:rawUrl
// =====================
export async function getDiagnosticsRaw(req: Request, res: Response) {
  try {
    const rawUrl = (req.params?.rawUrl || "").trim();
    if (!rawUrl) return res.status(400).json({ error: "Falta parámetro :rawUrl" });

    const { decoded, base, rxBase, rxOrigin } = normalizeUrlFromParam(rawUrl);
    const filter = buildDiagnosticsFilter(decoded, base, rxBase, rxOrigin);

    const doc = await Audit.findOne(filter).sort({ fecha: -1 }).lean();
    if (!doc) return res.status(404).json({ error: "No hay diagnósticos para esa URL" });

    return res.json(doc);
  } catch (e: any) {
    console.error("❌ getDiagnosticsRaw error:", e);
    return res.status(500).json({ error: "Error interno" });
  }
}

// =====================
// GET /api/diagnostics/:rawUrl/processed
// =====================
export async function getDiagnosticsProcessed(req: Request, res: Response) {
  try {
    const rawUrl = (req.params?.rawUrl || "").trim();
    if (!rawUrl) return res.status(400).json({ error: "Falta parámetro :rawUrl" });

    const { decoded, base, rxBase, rxOrigin } = normalizeUrlFromParam(rawUrl);
    const filter = buildDiagnosticsFilter(decoded, base, rxBase, rxOrigin);

    const doc = await Audit.findOne(filter).sort({ fecha: -1 }).lean();
    if (!doc) return res.status(404).json({ error: "No hay diagnósticos para esa URL" });

    const metrics = readMetrics(doc);
    const opportunities = extractOpportunities(doc);
    return res.json({ metrics, opportunities });
  } catch (e: any) {
    console.error("❌ getDiagnosticsProcessed error:", e);
    return res.status(500).json({ error: "Error interno" });
  }
}

// =====================
// GET /api/diagnostics/by-id/:id/processed
// =====================
export async function getDiagnosticsProcessedById(req: Request, res: Response) {
  try {
    const id = (req.params?.id || "").trim();
    if (!id) {
      console.error("❌ ID no proporcionado:", id);
      return res.status(400).json({ error: "ID no proporcionado" });
    }

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) {
      console.error("❌ ID inválido:", id);
      return res.status(400).json({ error: "ID inválido" });
    }

    const doc = await Audit.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "No encontrado" });

    const metrics = readMetrics(doc);
    const opportunities = extractOpportunities(doc);
    return res.json({ metrics, opportunities });
  } catch (e: any) {
    console.error("❌ getDiagnosticsProcessedById error:", e);
    return res.status(500).json({ error: "Error interno" });
  }
}

// -------- (NUEVO) Llamar al microservicio de seguridad --------
async function runSecurityMicro(url: string) {
  const endpoint = `${MS_SECURITY_URL}/api/analyze`;
  const payload = { url };
  const { data } = await axios.post(endpoint, payload, { timeout: 120000 });
  return data;
}

// forward reference (already implemented below)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _runPagespeedViaMicroRef: (url: string, strategy: 'mobile'|'desktop') => Promise<any> = runPagespeedViaMicro as any;