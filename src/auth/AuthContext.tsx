import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type UserRole = 'admin' | 'operario' | 'tecnico' | 'otro_tecnico' | 'cliente';
export type User = { _id: string; name: string; email: string; role: UserRole; title?: string | null; permissions?: string[] };

type AuthContextValue = {
  user: User | null;
  loading: boolean; // internal loading state during refresh
  initialized: boolean; // first refresh completed
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role?: UserRole, title?: string) => Promise<User>;
  logout: (opts?: { force?: boolean; origin?: 'ui' | 'auto' }) => Promise<void>;
  refresh: () => Promise<User | null>;
  refreshPermissions: () => Promise<string[]>; // helper to fetch updated permissions
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // refs para evitar race conditions / estado stale
  const userRef = useRef<User | null>(null);
  const lastLoginAtRef = useRef<number | null>(null);
  const refreshCounterRef = useRef(0);
  const suppressLogoutUntilRef = useRef<number | null>(null);
  const inFlightLoginRef = useRef<Promise<User> | null>(null);
  const lastLoginTsRef = useRef(0);
  // Token JWT en memoria (respaldo mientras la cookie aparece)
  const tokenRef = useRef<string | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);

  const refresh = async () => {
    const myId = ++refreshCounterRef.current;
    console.log('[Auth][refresh] start id=', myId);
    try {
      const headers: Record<string, string> = {};
      if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
      const res = await fetch('/api/auth/me', { credentials: 'include', headers });
      console.log('[Auth][refresh] status', res.status, 'id=', myId);

      if (!res.ok) {
        const lastLogin = lastLoginAtRef.current;
        const now = Date.now();
        const recentLoginWindow = 2000;
        if (!userRef.current && (!lastLogin || now - lastLogin > recentLoginWindow)) {
          console.log('[Auth][refresh] no auth -> clearing user id=', myId);
          setUser(null);
        } else {
          console.log('[Auth][refresh] no auth but ignored due to recent login or existing user id=', myId);
        }
        return null;
      }

      const data = await res.json();
      const u = data?.user as User | undefined;
      if (u) {
        if (myId === refreshCounterRef.current) {
          console.log('[Auth][refresh] got user', u.email, 'id=', myId);
          setUser(u);
          userRef.current = u;
        } else {
          console.log('[Auth][refresh] stale response ignored id=', myId, 'current=', refreshCounterRef.current);
        }
        return u;
      } else {
        const lastLogin = lastLoginAtRef.current;
        const now = Date.now();
        const recentLoginWindow = 2000;
        if (!userRef.current && (!lastLogin || now - lastLogin > recentLoginWindow)) {
          console.log('[Auth][refresh] empty payload -> clearing user id=', myId);
          setUser(null);
        } else {
          console.log('[Auth][refresh] empty payload but ignoring due to recent login or existing user id=', myId);
        }
        return null;
      }
    } catch (err) {
      console.log('[Auth][refresh] catch', err, 'id=', myId);
      const lastLogin = lastLoginAtRef.current;
      const now = Date.now();
      const recentLoginWindow = 2000;
      if (!userRef.current && (!lastLogin || now - lastLogin > recentLoginWindow)) {
        setUser(null);
      } else {
        console.log('[Auth][refresh] error ignored due to recent login or existing user id=', myId);
      }
      return null;
    } finally {
      setLoading(false);
      setInitialized(true);
      console.log('[Auth][refresh] done id=', myId);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LOGIN: protege contra llamadas concurrentes reutilizando la promesa en vuelo
  const login = async (email: string, password: string) => {
    // evitar envíos muy rápidos (protección extra)
    const nowTs = Date.now();
    if (nowTs - lastLoginTsRef.current < 200) {
      console.log('[Auth] login suppressed - too fast after previous attempt (<200ms)');
      // si hay in-flight reuse, devuélvela, si no, rechaza
      if (inFlightLoginRef.current) return inFlightLoginRef.current;
      throw new Error('Login suppressed - too fast');
    }
    lastLoginTsRef.current = nowTs;

    // si ya hay un login en curso, reutiliza la promesa para evitar dobles requests
    if (inFlightLoginRef.current) {
      console.log('[Auth] login: reuse in-flight promise');
      return inFlightLoginRef.current;
    }

    console.trace('[Auth] login trace - invoked by (stack):');
    console.log('[Auth] login start', email);
    const p = (async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        console.log('[Auth] login status', res.status);
        const data = await res.json();
        if (!res.ok) {
          console.log('[Auth] login fail', data);
          throw new Error(data?.error || 'Error al iniciar sesión');
        }

        const now = Date.now();
        lastLoginAtRef.current = now;
        // ampliar la ventana a 5s para evitar logouts espurios en dev
        suppressLogoutUntilRef.current = now + 5000; // 5s

        // Guarda token de respaldo si viene
        tokenRef.current = (data as any)?.token || null;

        setUser(data.user);
        userRef.current = data.user;
        setInitialized(true);

        console.log('[Auth] login success, set user', data.user?.email);
        return data.user as User;
      } finally {
        inFlightLoginRef.current = null;
      }
    })();

    inFlightLoginRef.current = p;
    return p;
  };

  const register = async (name: string, email: string, password: string, role?: UserRole, title?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password, role, title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error al registrar');
    const now = Date.now();
    lastLoginAtRef.current = now;
    suppressLogoutUntilRef.current = now + 5000;
    // token respaldo
    tokenRef.current = (data as any)?.token || null;
    setUser(data.user);
    userRef.current = data.user;
    return data.user as User;
  };

  // LOGOUT: opcionalmente forzable desde UI (opts.force === true)
  const logout = async (opts?: { force?: boolean; origin?: 'ui' | 'auto' }) => {
    // always log trace for debugging
    console.log('[Auth] manual logout called', opts ?? {});
    console.trace('[Auth] logout full trace (who invoked)');
    const origin = opts?.origin ?? 'auto';

    // estado interno para depuración
    const now = Date.now();
    console.log('[Auth] internal debug', {
      now,
      lastLoginAt: lastLoginAtRef.current,
      suppressUntil: suppressLogoutUntilRef.current,
      userPresent: !!userRef.current,
      origin,
    });

    const path = typeof window !== 'undefined' ? window.location.pathname : '';

    // Nunca ejecutar logout automático en rutas de auth
    if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/forgot') || path.startsWith('/reset')) {
      if (origin !== 'ui') {
        console.log('[Auth] logout ignored on auth route (non-UI origin)');
        return;
      }
    }

    // Ignorar logouts no forzados cuando no hay usuario
    if (!opts?.force && !userRef.current) {
      console.log('[Auth] logout ignored (no user + not forced)');
      return;
    }

    const suppressUntil = suppressLogoutUntilRef.current ?? 0;
    if (now < suppressUntil && origin !== 'ui') {
      console.log('[Auth] logout suppressed (within window, non-UI origin)', { now, suppressUntil });
      console.trace('[Auth] suppressed logout trace');
      return;
    }

    try {
      console.log('[Auth] performing logout fetch...');
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('[Auth] logout fetch error', e);
    } finally {
      setUser(null);
      userRef.current = null;
      tokenRef.current = null;
      lastLoginAtRef.current = null;
      suppressLogoutUntilRef.current = null;
      console.log('[Auth] logout completed (state cleared)');
      console.trace('[Auth] logout completed trace');
    }
  };

  const refreshPermissions = async () => {
    if(!userRef.current) return [] as string[];
    try {
      const res = await fetch('/api/auth/permissions', { credentials: 'include' });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error||'Error');
      const perms: string[] = data.permissions || [];
      setUser(u => u ? { ...u, permissions: perms } : u);
      return perms;
    } catch { return [] as string[]; }
  };

  const value = useMemo(
    () => ({ user, loading, initialized, login, register, logout, refresh, refreshPermissions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, initialized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}