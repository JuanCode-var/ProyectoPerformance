// server/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'operario' | 'tecnico' | 'cliente';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const COOKIE_NAME = process.env.COOKIE_NAME || 'perf_token';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change';

export function signToken(payload: AuthUser, options?: jwt.SignOptions) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d', ...options });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    return next();
  };
}

// Simple cache para permisos efectivos por rol
const ROLE_PERMS_CACHE = new Map<string, { perms: string[]; ts: number }>();
const ROLE_PERMS_TTL_MS = 60_000; // 1 min

// Cache adicional por usuario (overrides)
const USER_PERMS_CACHE = new Map<string, { perms: string[]; ts: number }>();
const USER_PERMS_TTL_MS = 30_000;

async function getEffectivePermissions(role: string): Promise<string[]> {
  try {
    // Cargar catálogo de permisos (admin obtiene todos)
    let PERMISSION_KEYS: Set<string>;
    if (role === 'admin') {
      try {
        if (typeof require !== 'undefined') {
          PERMISSION_KEYS = require('../utils/permissionsCatalog.js').PERMISSION_KEYS;
        } else {
          ({ PERMISSION_KEYS } = await import('../utils/permissionsCatalog.js'));
        }
        return Array.from(PERMISSION_KEYS);
      } catch (e:any) {
        console.error('[auth][perms] catalog load failed for admin err=%s', e?.message);
        return [];
      }
    }

    const now = Date.now();
    const cached = ROLE_PERMS_CACHE.get(role);
    if (cached && now - cached.ts < ROLE_PERMS_TTL_MS) return cached.perms;

    // Intentar leer documento persistido
    try {
      let RolePermissionsModel: any;
      if (typeof require !== 'undefined') {
        RolePermissionsModel = require('../database/rolePermissions.js').default;
      } else {
        ({ default: RolePermissionsModel } = await import('../database/rolePermissions.js'));
      }
      const doc = await RolePermissionsModel.findOne({ role }).lean();
      if (doc && Array.isArray(doc.permissions)) {
        ROLE_PERMS_CACHE.set(role, { perms: doc.permissions, ts: now });
        return doc.permissions;
      }
    } catch (e:any) {
      console.error('[auth][perms] DB lookup failed role=%s err=%s', role, e?.message);
    }

    // Fallback a defaults
    try {
      let defaultsForRoleFn: (r:string)=>string[];
      if (typeof require !== 'undefined') {
        defaultsForRoleFn = require('../utils/permissionsCatalog.js').defaultsForRole;
      } else {
        ({ defaultsForRole: defaultsForRoleFn } = await import('../utils/permissionsCatalog.js'));
      }
      const d = defaultsForRoleFn(role);
      ROLE_PERMS_CACHE.set(role, { perms: d, ts: now });
      return d;
    } catch (e:any) {
      console.error('[auth][perms] defaults load failed role=%s err=%s', role, e?.message);
      return [];
    }
  } catch (e:any) {
    console.error('[auth][perms] getEffectivePermissions fatal role=%s err=%s', role, e?.message);
    try {
      if (typeof require !== 'undefined') {
        return require('../utils/permissionsCatalog.js').defaultsForRole(role);
      } else {
        const mod = await import('../utils/permissionsCatalog.js');
        return mod.defaultsForRole(role);
      }
    } catch { return []; }
  }
}

// Cache de permisos efectivos por usuario
export async function getUserEffectivePermissions(user: AuthUser): Promise<string[]> {
  const now = Date.now();
  const cached = USER_PERMS_CACHE.get(user._id);
  if (cached && now - cached.ts < USER_PERMS_TTL_MS) return cached.perms;
  const base = await getEffectivePermissions(user.role);
  try {
    let UserModel: any;
    if (typeof require !== 'undefined') {
      UserModel = require('../database/user.js').default;
    } else {
      ({ default: UserModel } = await import('../database/user.js'));
    }
    const doc = await UserModel.findById(user._id, { userOverrides: 1 }).lean();
    if (doc?.userOverrides) {
      const allow: string[] = Array.isArray(doc.userOverrides.allow) ? doc.userOverrides.allow : [];
      const deny: string[] = Array.isArray(doc.userOverrides.deny) ? doc.userOverrides.deny : [];
      const merged = Array.from(new Set([...base, ...allow])).filter(p => !deny.includes(p));
      USER_PERMS_CACHE.set(user._id, { perms: merged, ts: now });
      return merged;
    }
  } catch (e:any) {
    console.error('[auth][perms] user overrides load failed user=%s err=%s', user._id, e?.message);
  }
  USER_PERMS_CACHE.set(user._id, { perms: base, ts: now });
  return base;
}

export function invalidateRolePermissionsCache(role?: string) {
  if (!role) { ROLE_PERMS_CACHE.clear(); return; }
  ROLE_PERMS_CACHE.delete(role);
}

export function invalidateUserPermissionsCache(userId?: string) {
  if (!userId) { USER_PERMS_CACHE.clear(); return; }
  USER_PERMS_CACHE.delete(userId);
}

export function requirePermissions(...perms: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    try {
      const effective = await getUserEffectivePermissions(req.user);
      if (process.env.DEBUG_PERMS === 'true') {
        console.log('[auth][perms] role=%s user=%s need=%o has=%o', req.user.role, req.user._id, perms, effective);
      }
      const missing = perms.filter(p => !effective.includes(p));
      if (missing.length) {
        if (process.env.DEBUG_PERMS === 'true') console.warn('[auth][perms] missing=%o', missing);
        return res.status(403).json({ error: 'Sin permisos', missing });
      }
      return next();
    } catch (e:any) {
      console.error('[auth][perms] validation error user=%s need=%o err=%s', req.user._id, perms, e?.message);
      return res.status(500).json({ error: 'No se pudieron validar permisos' });
    }
  };
}
