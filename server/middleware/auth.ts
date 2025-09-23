// server/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'operario' | 'tecnico' | 'otro_tecnico' | 'cliente';
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
