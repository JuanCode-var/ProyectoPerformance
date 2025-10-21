import { useCallback, useEffect, useState } from 'react';
import type { PermissionDef, RolePermissionsResponse, CatalogResponse, RoleKey } from '../shared/permissions';
import { useAuth } from '../auth/AuthContext';

interface UseRolePermissions {
  catalog: PermissionDef[];
  loading: boolean;
  error: string;
  role: RoleKey;
  permissions: string[];
  persisted: boolean;
  version?: number;
  setRole: (r: RoleKey) => void;
  toggle: (perm: string) => void;
  selectAllGroup: (group: string) => void;
  unselectAllGroup: (group: string) => void;
  save: () => Promise<{ ok: boolean; added: string[]; removed: string[] } | null>;
  reset: () => Promise<boolean>;
  dirty: boolean;
  diff: { added: string[]; removed: string[] };
}

const ROLES: RoleKey[] = ['admin','tecnico','operario','cliente'];

export function useRolePermissions(initialRole: RoleKey = 'tecnico'): UseRolePermissions {
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [role, setRole] = useState<RoleKey>(initialRole);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [original, setOriginal] = useState<string[]>([]);
  const [persisted, setPersisted] = useState(false);
  const [version, setVersion] = useState<number|undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, refreshPermissions } = useAuth();

  const loadCatalog = useCallback(async ()=> {
    try {
      const r = await fetch('/api/admin/permissions/catalog', { credentials: 'include' });
      const j: CatalogResponse = await r.json();
      if(!r.ok) throw new Error((j as any)?.error || 'Error catálogo');
      setCatalog(j.items || []);
    } catch(e:any){ setError(e?.message || 'Error cargando catálogo'); }
  },[]);

  const loadRole = useCallback(async (r: RoleKey)=> {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/permissions/roles/${r}`, { credentials: 'include' });
      const data: RolePermissionsResponse | any = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Error rol');
      setPermissions(data.permissions || []);
      setOriginal(data.permissions || []);
      setPersisted(Boolean(data.persisted));
      setVersion(data.version);
    } catch(e:any){ setError(e?.message || 'Error cargando rol'); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=> { loadCatalog(); }, [loadCatalog]);
  useEffect(()=> { loadRole(role); }, [role, loadRole]);

  const toggle = useCallback((perm: string) => {
    setPermissions(prev => prev.includes(perm) ? prev.filter(p=>p!==perm) : [...prev, perm]);
  },[]);

  const selectAllGroup = useCallback((group: string) => {
    const keys = catalog.filter(c=>c.group===group).map(c=>c.key);
    setPermissions(prev => Array.from(new Set([...prev, ...keys])));
  },[catalog]);

  const unselectAllGroup = useCallback((group: string) => {
    const keys = new Set(catalog.filter(c=>c.group===group).map(c=>c.key));
    setPermissions(prev => prev.filter(p => !keys.has(p)));
  },[catalog]);

  const save = useCallback(async ()=> {
    if (role === 'admin') return null; // no editable
    const body = { permissions };
    const res = await fetch(`/api/admin/permissions/roles/${role}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body), credentials: 'include' });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.error || 'Error guardando');
    setOriginal(data.permissions || []);
    setVersion(data.version);
    if (user?.role === role) { void refreshPermissions(); }
    return { ok: true, added: data.added||[], removed: data.removed||[] };
  },[permissions, role, user, refreshPermissions]);

  const reset = useCallback( async ()=> {
    if (role === 'admin') return false;
    const res = await fetch(`/api/admin/permissions/roles/${role}/reset`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.error || 'Error reset');
    setPermissions(data.permissions || []);
    setOriginal(data.permissions || []);
    setVersion(data.version);
    if (user?.role === role) { void refreshPermissions(); }
    return true;
  },[role, user, refreshPermissions]);

  const added = permissions.filter(p => !original.includes(p));
  const removed = original.filter(p => !permissions.includes(p));
  const dirty = added.length > 0 || removed.length > 0;

  return { catalog, loading, error, role, permissions, persisted, version, setRole, toggle, selectAllGroup, unselectAllGroup, save, reset, dirty, diff: { added, removed } };
}

export const ALL_ROLES = ROLES;