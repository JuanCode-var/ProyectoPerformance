// server/controllers/admin.controller.ts
import type { Request, Response } from 'express';
import User from '../database/user.js';
import type { AuthUser } from '../middleware/auth.js';
import AdminLog from '../database/adminLog.js';
import AdminVisit from '../database/adminVisit.js';
import crypto from 'crypto';

// In-memory buffers (simple, non-persistent)
const LOG_BUFFER: Array<{ ts: string; level: 'info'|'warn'|'error'; message: string; context?: any }> = [];
const VISIT_BUFFER: Array<{ ts: string; route: string; userId?: string; role?: string }> = [];
const MAX_BUFFER = 1000;

const PERSIST_LOGS = process.env.PERSIST_LOGS !== 'false';
const PERSIST_VISITS = process.env.PERSIST_VISITS !== 'false';

// Rate limiting simple por sesión/usuario/IP para telemetría
const RATE_BUCKET = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000; // 1 minuto
const RATE_LIMIT = Number(process.env.TELEMETRY_RATE_LIMIT || 120);

function pushLog(row: { level: 'info'|'warn'|'error'; message: string; context?: any }) {
  const entry = { ts: new Date().toISOString(), ...row };
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
  // fire-and-forget persistence
  if (PERSIST_LOGS) {
    // no await to avoid blocking requests
    void AdminLog.create({ ts: new Date(entry.ts), level: entry.level, message: entry.message, context: entry.context }).catch(() => {});
  }
}

export function recordVisit(route: string, user?: AuthUser | null) {
  const entry = { ts: new Date().toISOString(), route, userId: user?._id, role: user?.role };
  VISIT_BUFFER.push(entry);
  if (VISIT_BUFFER.length > MAX_BUFFER) VISIT_BUFFER.shift();
  if (PERSIST_VISITS) {
    void AdminVisit.create({ ts: new Date(entry.ts), route: entry.route, userId: entry.userId ?? null, role: entry.role ?? null, event: 'server_visit' }).catch(() => {});
  }
}

export async function listUsers(_req: Request, res: Response) {
  try {
    const docs = await User.find({}, { name: 1, email: 1, role: 1, isActive: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 }).lean();
    return res.json(docs);
  } catch (e: any) {
    pushLog({ level: 'error', message: 'listUsers failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'Error listando usuarios' });
  }
}

export async function getLogs(req: Request, res: Response) {
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 200));
  // Prefer DB if persistence enabled
  if (PERSIST_LOGS) {
    try {
      const items = await AdminLog.find({}, { _id: 0, ts: 1, level: 1, message: 1, context: 1 })
        .sort({ ts: -1 })
        .limit(limit)
        .lean();
      return res.json(items.map(i => ({ ts: (i.ts as any)?.toISOString?.() ?? String(i.ts), level: i.level, message: i.message, context: (i as any).context })));
    } catch (e: any) {
      pushLog({ level: 'error', message: 'getLogs db failed, falling back to buffer', context: { error: e?.message } });
    }
  }
  const items = LOG_BUFFER.slice(-limit);
  return res.json(items);
}

export async function getTelemetry(req: Request, res: Response) {
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit) || 1000));
  const roleFilter = (req.query.role as string | undefined) || 'cliente';
  const eventFilter = (req.query.event as string | undefined) || undefined;
  const q: any = {};
  if (roleFilter) q.role = roleFilter;
  if (eventFilter) q.event = eventFilter;

  if (PERSIST_VISITS) {
    try {
      const items = await AdminVisit.find(q, { _id: 0, ts: 1, route: 1, userId: 1, role: 1, event: 1, durationMs: 1, sessionId: 1, meta: 1 })
        .sort({ ts: -1 })
        .limit(limit)
        .lean();
      return res.json(items.map(i => ({
        ts: (i.ts as any)?.toISOString?.() ?? String(i.ts),
        route: i.route,
        userId: i.userId ?? undefined,
        role: i.role ?? undefined,
        event: (i as any).event,
        durationMs: (i as any).durationMs ?? undefined,
        sessionId: (i as any).sessionId ?? undefined,
        meta: (i as any).meta ?? undefined,
      })));
    } catch (e: any) {
      pushLog({ level: 'error', message: 'getTelemetry db failed, falling back to buffer', context: { error: e?.message } });
    }
  }
  const items = VISIT_BUFFER.slice(-limit);
  return res.json(items);
}

export async function trackTelemetry(req: Request, res: Response) {
  try {
    // Normalizar y validar inputs
    const rawRoute = String(req.body?.route || req.query?.route || '').slice(0, 2048);
    let route = rawRoute.trim();
    if (!route.startsWith('/')) route = '/' + route;
    // limitar eventos permitidos
    const allowedEvents = new Set(['route_view','route_leave','client_event']);
    const eventRaw = String(req.body?.event || 'route_view');
    const event = (allowedEvents.has(eventRaw) ? eventRaw : 'client_event') as 'route_view' | 'route_leave' | 'client_event';

    const durationMs = typeof req.body?.durationMs === 'number' && isFinite(req.body.durationMs) && req.body.durationMs >= 0
      ? Math.min(req.body.durationMs, 1000 * 60 * 60) // max 1h
      : undefined;
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.slice(0,128) : undefined;

    // Meta segura (limitar tamaño y claves conocidas)
    const allowKeys = new Set(['component','action','label','severity','extra']);
    let meta: any = undefined;
    if (req.body?.meta && typeof req.body.meta === 'object') {
      try {
        const entries = Object.entries(req.body.meta as Record<string, unknown>)
          .filter(([k]) => allowKeys.has(k))
          .slice(0, 20);
        meta = Object.fromEntries(entries);
      } catch {
        meta = undefined;
      }
    }

    if (!route) return res.status(400).json({ error: 'route requerida' });

    // Señales de verificación
    const user = req.user || null;
    const ref = String(req.get('referer') || '');
    const refOk = !!(ref && route && ref.includes(route));
    const srcIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const ua = String(req.get('user-agent') || '').slice(0, 200);
    const ipHash = srcIp ? crypto.createHash('sha256').update(String(srcIp)).digest('hex').slice(0, 16) : undefined;

    // Rate limiting por clave de bucket
    const key = sessionId || user?._id || ipHash || 'anon';
    const now = Date.now();
    const cur = RATE_BUCKET.get(key);
    let count = 1, resetAt = now + RATE_WINDOW_MS;
    if (cur && now < cur.resetAt) {
      count = cur.count + 1;
      resetAt = cur.resetAt;
    }
    RATE_BUCKET.set(key, { count, resetAt });

    // Severidad y flags
    const metaFlags: any = {
      ...(meta || {}),
      verified: Boolean(user?._id),
      refOk,
      ipHash,
      ua,
    };
    if (count > RATE_LIMIT) {
      metaFlags.severity = metaFlags.severity || 'warn';
      metaFlags.tooMany = count;
    }

    // Buffer mínimo (solo ruta y usuario)
    const entry = { ts: new Date().toISOString(), route, userId: user?._id, role: user?.role };
    VISIT_BUFFER.push(entry);
    if (VISIT_BUFFER.length > MAX_BUFFER) VISIT_BUFFER.shift();

    // Persistencia
    if (PERSIST_VISITS) {
      void AdminVisit.create({
        ts: new Date(entry.ts),
        route,
        userId: entry.userId ?? null,
        role: entry.role ?? null,
        event,
        durationMs: durationMs ?? null,
        sessionId: sessionId ?? null,
        meta: metaFlags,
      }).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (e: any) {
    pushLog({ level: 'error', message: 'trackTelemetry failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo registrar telemetría' });
  }
}

export async function clearLogs(req: Request, res: Response) {
  try {
    // Limpiar buffer en memoria
    (LOG_BUFFER as any).length = 0;
    // Limpiar colección si persiste
    if (PERSIST_LOGS) {
      await AdminLog.deleteMany({});
    }
    pushLog({ level: 'info', message: 'Logs limpiados manualmente', context: { by: req.user?._id } });
    return res.json({ ok: true });
  } catch (e: any) {
    pushLog({ level: 'error', message: 'clearLogs failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudieron limpiar los logs' });
  }
}

export async function clearTelemetry(req: Request, res: Response) {
  try {
    (VISIT_BUFFER as any).length = 0;
    if (PERSIST_VISITS) {
      await AdminVisit.deleteMany({});
    }
    pushLog({ level: 'info', message: 'Telemetry limpiada manualmente', context: { by: req.user?._id } });
    return res.json({ ok: true });
  } catch (e: any) {
    pushLog({ level: 'error', message: 'clearTelemetry failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo limpiar la telemetría' });
  }
}

// Request logger helper for server/index.ts
export function logRequest(method: string, url: string) {
  pushLog({ level: 'info', message: `${method} ${url}` });
}

export default { listUsers, getLogs, getTelemetry, trackTelemetry, recordVisit, logRequest, clearLogs, clearTelemetry };
