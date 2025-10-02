// server/controllers/admin.controller.ts
import type { Request, Response } from 'express';
import User, { type UserRole } from '../database/user.js';
import type { AuthUser } from '../middleware/auth.js';
import AdminLog from '../database/adminLog.js';
import AdminVisit from '../database/adminVisit.js';
import crypto from 'crypto';
import TelemetryEvent from '../database/telemetryEvent.js';
import RoleAudit from '../database/roleAudit.js';
import { hrTimer, emitTelemetry, hashUrl, categorizeError } from '../utils/telemetry.js';
import RolePermissions from '../database/rolePermissions.js';
import { PERMISSION_KEYS, defaultsForRole } from '../utils/permissionsCatalog.js';
import { invalidateRolePermissionsCache } from '../middleware/auth.js';
// Add missing import for user-level cache invalidation
import { invalidateUserPermissionsCache } from '../middleware/auth.js';

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
  const now = new Date();
  const entry = { ts: now.toISOString(), route, userId: user?._id, role: user?.role };
  // Ya no se deduplica: cada invocación registra una visita (requisito actualizado)
  VISIT_BUFFER.push(entry as any);
  if (VISIT_BUFFER.length > MAX_BUFFER) VISIT_BUFFER.shift();
  if (PERSIST_VISITS) {
    const doc: any = { ts: now, route: entry.route, userId: entry.userId ?? null, role: entry.role ?? null, event: 'server_visit' };
    void AdminVisit.create(doc).catch(() => {});
  }
}

export async function listUsers(_req: Request, res: Response) {
  try {
    const docs = await User.find({}, { name: 1, email: 1, role: 1, isActive: 1, createdAt: 1, updatedAt: 1, userOverrides: 1 }).sort({ createdAt: -1 }).lean();
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

export async function getTelemetrySummary(req: Request, res: Response) {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const matchSince = { ts: { $gte: since } } as any;

    // Agregaciones (actualizado: se elimina diag por tipo, añadimos urlSample y nombres de usuario)
    const [diagTotals, microAgg, roleAgg, userAgg, urlAgg, pdfAgg, microFailAgg, errorCatAgg, emailTypeAgg, emailFailAgg, logLevels,
      userDiagAgg, urlDiagAgg, visitRoleAgg, microCallsTotalAgg, recentDiagAgg, missingUrlAgg] = await Promise.all([
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end', durationMs: { $ne: null } } },
        { $group: { _id: null, avgTotalMs: { $avg: '$durationMs' }, total: { $sum: 1 } } },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.micro_call', micro: { $ne: null }, durationMs: { $ne: null } } },
        { $group: { _id: '$micro', avgMs: { $avg: '$durationMs' }, count: { $sum: 1 }, failCount: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end' } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      // Usuarios top (solo conteo). Luego haremos lookup para nombres.
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end', userId: { $ne: null } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      // URLs top: añadimos sample real (urlSample) más reciente
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end', urlHash: { $ne: null } } },
        { $group: { _id: '$urlHash', count: { $sum: 1 }, lastTs: { $max: '$ts' } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'email.sent', emailType: 'diagnostic' } },
        { $group: { _id: null, sent: { $sum: 1 }, withPdf: { $sum: { $cond: [ { $eq: ['$hasPdf', true] }, 1, 0 ] } }, avgPdfSizeKb: { $avg: '$pdfSizeKb' } } },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.micro_call', success: false, micro: { $ne: null } } },
        { $group: { _id: '$micro', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.micro_call', success: false, errorCategory: { $ne: null } } },
        { $group: { _id: '$errorCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'email.sent', emailType: { $ne: null } } },
        { $group: { _id: '$emailType', count: { $sum: 1 } } },
      ]),
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'email.sent', success: false } },
        { $group: { _id: null, failures: { $sum: 1 } } },
      ]),
      AdminLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
      // Diags por usuario (detalle)
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end', userId: { $ne: null } } },
        { $group: { _id: { userId: '$userId' }, total: { $sum: 1 } } },
        { $project: { userId: '$_id.userId', total: 1 } },
        { $limit: 200 },
      ]),
      // Diags por URL hash (detalle)
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end', urlHash: { $ne: null } } },
        { $group: { _id: '$urlHash', total: { $sum: 1 }, lastTs: { $max: '$ts' } } },
        { $limit: 200 },
      ]),
      // Visitas por rol
      AdminVisit.aggregate([
        { $match: { ts: { $gte: since }, role: { $ne: null } } },
        { $group: { _id: '$role', visits: { $sum: 1 } } },
        { $sort: { visits: -1 } }
      ]),
      // total micro_calls
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.micro_call' } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ]),
      // últimos diagnósticos (lista reciente)
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end' } },
        { $sort: { ts: -1 } },
        { $limit: 40 },
        { $project: { _id: 0, ts: 1, userId: 1, role: 1, urlHash: 1, urlSample: 1, durationMs: 1 } }
      ]),
      // conteo diagnósticos sin URL
      TelemetryEvent.aggregate([
        { $match: { ...matchSince, kind: 'diagnostic.end', $or: [ { urlHash: null }, { urlHash: { $exists: false } } ] } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ])
    ]);

    // Enriquecer usuarios con nombres
    const userIds = userAgg.map(u => u._id).filter(Boolean);
    const userDocs = userIds.length ? await User.find({ _id: { $in: userIds } }, { name: 1, role: 1 }).lean() : [];
    const userNameMap = new Map<string, { name?: string; role?: string }>();
    for (const u of userDocs) userNameMap.set(String((u as any)._id), { name: (u as any).name, role: (u as any).role });

    // Enriquecer URLs con muestra (buscar último evento con ese hash)
    const urlHashes = urlAgg.map(u => u._id).filter(Boolean);
    const urlSamplesDocs = urlHashes.length ? await TelemetryEvent.aggregate([
      { $match: { kind: 'diagnostic.end', urlHash: { $in: urlHashes } } },
      { $sort: { ts: -1 } },
      { $group: { _id: '$urlHash', sample: { $first: '$urlSample' } } }
    ]) : [];
    const urlSampleMap = new Map<string, string | null>();
    for (const d of urlSamplesDocs) urlSampleMap.set(d._id, d.sample || null);

    const diagTotalsObj = diagTotals[0] || { avgTotalMs: null, total: 0 };
    const pdfObj = pdfAgg[0] || { sent: 0, withPdf: 0, avgPdfSizeKb: null };
    const byRole: Record<string, number> = {};
    for (const r of roleAgg) { byRole[r._id || 'unknown'] = r.count; }
    // Asegurar roles existentes aunque sean 0
    ['admin','tecnico','operario','cliente'].forEach(role => { if (!(role in byRole)) byRole[role] = 0; });

    const visitsByRole = visitRoleAgg.map(v => ({ role: v._id || 'unknown', visits: v.visits }));
    // Asegurar visitas también contengan roles faltantes
    const visitsMap: Record<string, number> = {}; for (const v of visitsByRole) visitsMap[v.role] = v.visits;
    ['admin','tecnico','operario','cliente'].forEach(role => { if (!(role in visitsMap)) visitsByRole.push({ role, visits: 0 }); });

    const response = {
      range: { from: since.toISOString(), to: new Date().toISOString(), days },
      diagnostics: {
        total: diagTotalsObj.total,
        avgTotalMs: diagTotalsObj.avgTotalMs,
        micros: microAgg.map(m => ({ micro: m._id, avgMs: m.avgMs, count: m.count, failCount: m.failCount })),
        microCallsTotal: microCallsTotalAgg?.[0]?.total || 0,
        byRole,
        byUser: userAgg.map(u => ({ userId: u._id, count: u.count, name: userNameMap.get(u._id)?.name, role: userNameMap.get(u._id)?.role })),
        byUrl: urlAgg.map(u => ({ urlHash: u._id, count: u.count, url: urlSampleMap.get(u._id) || null })),
        pdf: { sent: pdfObj.sent, withPdf: pdfObj.withPdf, avgPdfSizeKb: pdfObj.avgPdfSizeKb },
        errors: {
          byCategory: errorCatAgg.map(e => ({ errorCategory: e._id, count: e.count })),
          topMicroFailures: microFailAgg.map(e => ({ micro: e._id, count: e.count })),
        },
        detail: {
          users: userDiagAgg.map(u => ({ userId: u.userId, total: u.total, name: userNameMap.get(u.userId || '')?.name })),
          urls: urlDiagAgg.map(u => ({ urlHash: u._id, total: u.total, url: urlSampleMap.get(u._id) || null })),
        },
        visitsByRole,
        recent: recentDiagAgg.map((d:any) => ({
          ts: d.ts,
          userId: d.userId || null,
            name: d.userId ? (userNameMap.get(String(d.userId))?.name || null) : null,
            role: d.role || userNameMap.get(String(d.userId||''))?.role || null,
          url: d.urlSample || null,
          durationMs: d.durationMs || null
        })),
        missingUrlCount: missingUrlAgg?.[0]?.count || 0,
      },
      emails: {
        totalSent: emailTypeAgg.reduce((a, c) => a + c.count, 0),
        byType: emailTypeAgg.map(e => ({ emailType: e._id, count: e.count })),
        failures: (emailFailAgg[0]?.failures) || 0,
      },
      logs: { levels: logLevels.map(l => ({ level: l._id, count: l.count })) }
    };
    return res.json(response);
  } catch (e: any) {
    return res.status(500).json({ error: 'Error generando resumen', detail: e?.message });
  }
}

export async function getLogSummary(req: Request, res: Response) {
  try {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [levels, lastErrors] = await Promise.all([
      AdminLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
      AdminLog.find({ level: 'error', createdAt: { $gte: since } }, { _id: 0, ts: 1, message: 1 })
        .sort({ ts: -1 })
        .limit(20)
        .lean(),
    ]);

    return res.json({
      range: { from: since.toISOString(), to: new Date().toISOString(), days },
      levels: levels.map(l => ({ level: l._id, count: l.count })),
      lastErrors: lastErrors.map(e => ({ ts: (e.ts as any)?.toISOString?.() ?? String(e.ts), message: e.message })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error generando resumen de logs', detail: e?.message });
  }
}

// Request logger helper for server/index.ts
export function logRequest(method: string, url: string) {
  pushLog({ level: 'info', message: `${method} ${url}` });
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, role, isActive, resetPassword } = req.body || {};
    const user = await User.findById(id);
    if(!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const prevRole = user.role || null;
    if(typeof name === 'string' && name.trim()) user.name = name.trim().slice(0,120);
    let roleChanged = false;
    // Validar rol permitido antes de asignar (removido otro_tecnico)
    if (typeof role === 'string' && role !== user.role) {
      const allowedRoles: UserRole[] = ['admin','tecnico','operario','cliente'];
      if (!allowedRoles.includes(role as UserRole)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }
      user.role = role as UserRole;
      roleChanged = true;
    }
    if(typeof isActive === 'boolean') user.isActive = isActive;
    let tempPassword: string | undefined;
    if(resetPassword === true) {
      tempPassword = crypto.randomBytes(5).toString('hex');
      (user as any).password = tempPassword; // asumiendo hash middleware pre-save
    }
    await user.save();
    if(roleChanged) {
      void RoleAudit.create({
        ts: new Date(),
        targetUserId: user._id,
        targetUserName: user.name || null,
        previousRole: prevRole,
        newRole: user.role,
        changedById: (req.user as any)?._id,
        changedByName: (req.user as any)?.name || null,
      }).catch(()=>{});
      pushLog({ level: 'info', message: 'role_changed', context: { target: user._id, previousRole: prevRole, newRole: user.role, by: req.user?._id } });
    }
    return res.json({ ok: true, roleChanged, tempPassword });
  } catch(e:any) {
    pushLog({ level: 'error', message: 'updateUser failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo actualizar usuario' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = (req.body || {}) as { reason?: string };
    const user = await User.findById(id);
    if(!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const allowedReasons = ['baja_voluntaria','inactividad','duplicado','fraude','otro'];
    const reasonSafe = reason && allowedReasons.includes(reason) ? reason : 'otro';
    const prevRole = user.role || null;
    const name = user.name || null;
    // Eliminación definitiva
    await User.deleteOne({ _id: user._id });
    pushLog({ level: 'warn', message: 'user_deleted', context: { target: user._id, by: req.user?._id, reason: reasonSafe } });
    try {
      await RoleAudit.create({
        ts: new Date(),
        targetUserId: user._id,
        targetUserName: name,
        previousRole: prevRole,
        newRole: prevRole, // mantenemos rol previo para trazabilidad
        changedById: (req.user as any)?._id,
        changedByName: (req.user as any)?.name || null,
        note: `delete:${reasonSafe}`
      });
    } catch {}
    return res.json({ ok: true, deleted: true, reason: reasonSafe });
  } catch(e:any) {
    pushLog({ level: 'error', message: 'deleteUser failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo eliminar usuario' });
  }
}

export async function getRoleAudit(req: Request, res: Response) {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days*24*60*60*1000);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const rows = await RoleAudit.find({ ts: { $gte: since } })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();
    return res.json({ range: { from: since.toISOString(), to: new Date().toISOString(), days }, total: rows.length, items: rows.map(r => ({
      ts: (r.ts as any).toISOString?.() || String(r.ts),
      targetUserId: r.targetUserId,
      targetUserName: (r as any).targetUserName || null,
      previousRole: r.previousRole,
      newRole: r.newRole,
      changedById: r.changedById,
      changedByName: (r as any).changedByName || null,
      note: (r as any).note || null,
    })) });
  } catch(e:any) {
    return res.status(500).json({ error: 'No se pudo obtener auditoría', detail: e?.message });
  }
}

// --- Role Permissions Controllers ---
export async function getPermissionsCatalog(_req: Request, res: Response) {
  try {
    const { PERMISSIONS_CATALOG } = require('../utils/permissionsCatalog.js');
    return res.json({ items: PERMISSIONS_CATALOG });
  } catch (e:any) { return res.status(500).json({ error: 'No se pudo cargar catálogo', detail: e?.message }); }
}

export async function getRolePermissions(req: Request, res: Response) {
  try {
    const role = String(req.params.role || '').trim();
    if(!role) return res.status(400).json({ error: 'role requerido' });
    const doc = await RolePermissions.findOne({ role }).lean();
    if (doc) return res.json({ role, permissions: doc.permissions, persisted: true });
    return res.json({ role, permissions: defaultsForRole(role), persisted: false });
  } catch(e:any){ return res.status(500).json({ error: 'No se pudieron obtener permisos', detail: e?.message }); }
}

export async function upsertRolePermissions(req: Request, res: Response) {
  try {
    const role = String(req.params.role || '').trim();
    console.log('[perms][upsert] start role=%s body=%o', role, req.body);
    if(!role) return res.status(400).json({ error: 'role requerido' });
    if(role === 'admin') return res.status(400).json({ error: 'Rol admin no editable' });
    const input: unknown = req.body?.permissions;
    if(!Array.isArray(input)) return res.status(400).json({ error: 'permissions debe ser array' });
    const unique = Array.from(new Set(input.map(p => String(p))));
    // Validar claves
    for (const k of unique) { if(!PERMISSION_KEYS.has(k)) { console.warn('[perms][upsert] invalid key=%s role=%s', k, role); return res.status(400).json({ error: 'Permiso inválido', permission: k }); } }
    const essential = ['security.view_basic'];
    if (['tecnico','operario','cliente'].includes(role) && !essential.every(e => unique.includes(e))) {
      console.warn('[perms][upsert] missing essential %o for role=%s', essential.filter(e=>!unique.includes(e)), role);
      return res.status(400).json({ error: 'Faltan permisos esenciales', essentialMissing: essential.filter(e=>!unique.includes(e)) });
    }
    const now = new Date();
    const prev = await RolePermissions.findOne({ role });
    let added: string[] = []; let removed: string[] = []; let saved;
    if (prev) {
      added = unique.filter(p => !prev.permissions.includes(p));
      removed = prev.permissions.filter(p => !unique.includes(p));
      prev.permissions = unique;
      prev.updatedAt = now;
      prev.updatedBy = (req.user as any)?._id || null;
      prev.version = (prev.version || 1) + 1;
      saved = await prev.save();
    } else {
      added = unique;
      saved = await RolePermissions.create({ role, permissions: unique, updatedAt: now, updatedBy: (req.user as any)?._id || null, version: 1 });
    }
    console.log('[perms][upsert] persisted role=%s added=%d removed=%d version=%s', role, added.length, removed.length, saved.version);
    if (added.length || removed.length) {
      try { await RoleAudit.create({ ts: now, targetUserId: (req.user as any)?._id, targetUserName: (req.user as any)?.name || null, previousRole: role, newRole: role, changedById: (req.user as any)?._id, changedByName: (req.user as any)?.name || null, note: `perm_update: +${added.length} -${removed.length}` }); } catch {}
      invalidateRolePermissionsCache(role);
    }
    return res.json({ ok: true, role, permissions: saved.permissions, added, removed, version: saved.version });
  } catch(e:any){
    console.error('[perms][upsert] error role=%s err=%s stack=%s', req.params.role, e?.message, e?.stack);
    return res.status(500).json({ error: 'No se pudo actualizar permisos', detail: e?.message });
  }
}

export async function resetRolePermissions(req: Request, res: Response) {
  try {
    const role = String(req.params.role || '').trim();
    if(!role) return res.status(400).json({ error: 'role requerido' });
    if(role === 'admin') return res.status(400).json({ error: 'Rol admin no editable' });
    const defaults = defaultsForRole(role);
    const now = new Date();
    const doc = await RolePermissions.findOneAndUpdate(
      { role },
      { $set: { permissions: defaults, updatedAt: now, updatedBy: (req.user as any)?._id || null }, $inc: { version: 1 } },
      { new: true, upsert: true }
    );
    try { await RoleAudit.create({ ts: now, targetUserId: (req.user as any)?._id, targetUserName: (req.user as any)?.name||null, previousRole: role, newRole: role, changedById: (req.user as any)?._id, changedByName: (req.user as any)?.name||null, note: 'perm_reset' }); } catch {}
    invalidateRolePermissionsCache(role);
    return res.json({ ok: true, role, permissions: doc.permissions, version: doc.version, reset: true });
  } catch(e:any){ return res.status(500).json({ error: 'No se pudo resetear permisos', detail: e?.message }); }
}

export async function listAllRolePermissions(_req: Request, res: Response) {
  try {
    const roles = ['admin','tecnico','operario','cliente'];
    const docs = await RolePermissions.find({ role: { $in: roles } }).lean();
    const map = new Map<string,string[]>();
    for (const d of docs) map.set(d.role, d.permissions as string[]);
    const out = roles.map(r => ({ role: r, permissions: r === 'admin' ? Array.from(PERMISSION_KEYS) : (map.get(r) || defaultsForRole(r)), persisted: map.has(r) }));
    return res.json({ items: out });
  } catch(e:any){ return res.status(500).json({ error: 'No se pudieron listar permisos', detail: e?.message }); }
}

export async function listRawRolePermissions(_req: Request, res: Response) {
  try {
    const docs = await RolePermissions.find({}).lean();
    return res.json({ total: docs.length, items: docs });
  } catch(e:any){ return res.status(500).json({ error: 'No se pudo listar role_permissions', detail: e?.message }); }
}

// --- Per-user permission overrides (histórico) ---
const HISTORY_PERMS = ['security.view_history','performance.view_history'];

function ensureArrays(obj: any) {
  if (!obj.userOverrides) obj.userOverrides = { allow: [], deny: [] };
  if (!Array.isArray(obj.userOverrides.allow)) obj.userOverrides.allow = [];
  if (!Array.isArray(obj.userOverrides.deny)) obj.userOverrides.deny = [];
}

export async function grantUserHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if(!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    ensureArrays(user as any);
    let changed = false;
    for (const p of HISTORY_PERMS) {
      if (!(user as any).userOverrides.allow.includes(p)) { (user as any).userOverrides.allow.push(p); changed = true; }
      const denyIdx = (user as any).userOverrides.deny.indexOf(p);
      if (denyIdx >= 0) { (user as any).userOverrides.deny.splice(denyIdx,1); changed = true; }
    }
    if (changed) { await user.save(); }
    invalidateUserPermissionsCache(String(user._id));
    pushLog({ level: 'info', message: 'user_history_granted', context: { target: user._id, by: req.user?._id } });
    try { await RoleAudit.create({ ts: new Date(), targetUserId: user._id, targetUserName: user.name||null, previousRole: user.role, newRole: user.role, changedById: (req.user as any)?._id, changedByName: (req.user as any)?.name||null, note: 'user_override:+history' }); } catch {}
    return res.json({ ok: true, overrides: (user as any).userOverrides });
  } catch(e:any) {
    pushLog({ level: 'error', message: 'grantUserHistory failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo conceder histórico' });
  }
}

export async function revokeUserHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if(!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    ensureArrays(user as any);
    let changed = false;
    for (const p of HISTORY_PERMS) {
      const allowIdx = (user as any).userOverrides.allow.indexOf(p);
      if (allowIdx >= 0) { (user as any).userOverrides.allow.splice(allowIdx,1); changed = true; }
      if (!(user as any).userOverrides.deny.includes(p)) { (user as any).userOverrides.deny.push(p); changed = true; }
    }
    if (changed) { await user.save(); }
    invalidateUserPermissionsCache(String(user._id));
    pushLog({ level: 'info', message: 'user_history_revoked', context: { target: user._id, by: req.user?._id } });
    try { await RoleAudit.create({ ts: new Date(), targetUserId: user._id, targetUserName: user.name||null, previousRole: user.role, newRole: user.role, changedById: (req.user as any)?._id, changedByName: (req.user as any)?.name||null, note: 'user_override:-history' }); } catch {}
    return res.json({ ok: true, overrides: (user as any).userOverrides });
  } catch(e:any) {
    pushLog({ level: 'error', message: 'revokeUserHistory failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo revocar histórico' });
  }
}

export async function updateUserOverrides(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { permission, action } = req.body || {};
    if (typeof permission !== 'string' || !permission.trim()) return res.status(400).json({ error: 'permission requerido' });
    if (!['allow','deny','clear'].includes(action)) return res.status(400).json({ error: 'action inválida' });
    if (!PERMISSION_KEYS.has(permission)) return res.status(400).json({ error: 'Permiso desconocido', permission });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // proteger: podrías impedir overrides sobre admin si se desea
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'No se gestionan overrides para admin' });
    }

    // asegurar estructura
    if (!(user as any).userOverrides) (user as any).userOverrides = { allow: [], deny: [] };
    if (!Array.isArray((user as any).userOverrides.allow)) (user as any).userOverrides.allow = [];
    if (!Array.isArray((user as any).userOverrides.deny)) (user as any).userOverrides.deny = [];

    const allow: string[] = (user as any).userOverrides.allow;
    const deny: string[] = (user as any).userOverrides.deny;
    let changed = false;

    const rem = (arr: string[], p: string) => { const i = arr.indexOf(p); if (i >= 0) { arr.splice(i,1); return true; } return false; };
    const addUnique = (arr: string[], p: string) => { if (!arr.includes(p)) { arr.push(p); return true; } return false; };

    if (action === 'allow') {
      changed = addUnique(allow, permission) || changed;
      changed = rem(deny, permission) || changed;
    } else if (action === 'deny') {
      changed = addUnique(deny, permission) || changed;
      changed = rem(allow, permission) || changed;
    } else if (action === 'clear') {
      changed = rem(allow, permission) || changed;
      changed = rem(deny, permission) || changed;
    }

    if (changed) await user.save();
    invalidateUserPermissionsCache(String(user._id));
    pushLog({ level: 'info', message: 'user_override_changed', context: { target: user._id, perm: permission, action, by: req.user?._id } });
    try { await RoleAudit.create({ ts: new Date(), targetUserId: user._id, targetUserName: user.name||null, previousRole: user.role, newRole: user.role, changedById: (req.user as any)?._id, changedByName: (req.user as any)?.name||null, note: `override:${action}:${permission}` }); } catch {}
    return res.json({ ok: true, changed, overrides: (user as any).userOverrides });
  } catch(e:any) {
    pushLog({ level: 'error', message: 'updateUserOverrides failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo actualizar override' });
  }
}

export async function getUserEffectivePermissionsAdmin(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = await User.findById(id, { role:1, userOverrides:1, email:1, name:1 }).lean();
    if(!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    // dynamic import to reuse logic
    let helper: any;
    try { ({ getUserEffectivePermissions: helper } = await import('../middleware/auth.js')); } catch { helper = null; }
    let perms: string[] = [];
    if (helper) {
      perms = await helper({ _id: String(user._id), role: user.role, name: user.name || '', email: user.email || '' } as any);
    } else {
      perms = defaultsForRole(user.role);
      if (user.userOverrides) {
        const allow = Array.isArray((user as any).userOverrides.allow) ? (user as any).userOverrides.allow : [];
        const deny = Array.isArray((user as any).userOverrides.deny) ? (user as any).userOverrides.deny : [];
        perms = Array.from(new Set([...perms, ...allow])).filter(p=> !deny.includes(p));
      }
    }
    return res.json({ ok: true, user: { _id: user._id, role: user.role, name: user.name, email: user.email }, overrides: user.userOverrides || { allow: [], deny: [] }, effective: perms });
  } catch(e:any) {
    pushLog({ level: 'error', message: 'getUserEffectivePermissionsAdmin failed', context: { error: e?.message } });
    return res.status(500).json({ error: 'No se pudo calcular permisos efectivos' });
  }
}

export default { listUsers, getLogs, getTelemetry, trackTelemetry, recordVisit, logRequest, clearLogs, clearTelemetry, getTelemetrySummary, getLogSummary, updateUser, deleteUser, getRoleAudit, getPermissionsCatalog, getRolePermissions, upsertRolePermissions, resetRolePermissions, listAllRolePermissions, listRawRolePermissions, grantUserHistory, revokeUserHistory, updateUserOverrides, getUserEffectivePermissionsAdmin };
