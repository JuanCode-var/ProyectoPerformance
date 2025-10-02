import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { useAuth } from '../../auth/AuthContext';

interface UserOverrides { allow?: string[]; deny?: string[] }
interface UserInfo { _id: string; name: string; email: string; role: string; userOverrides?: UserOverrides }

const PERM_GROUPS: Array<{ title: string; keys: string[]; description?: string }> = [
  { title: 'Seguridad - Desgloses (detalle headers, cookies, findings, plan)', keys: ['security.view_headers','security.view_cookies','security.view_findings','security.view_action_plan'] },
  { title: 'Performance - Desgloses', keys: ['performance.view_breakdowns'] },
  { title: 'Performance - Plan de acción', keys: ['performance.view_action_plan'] },
];

export default function UserDetailOverridesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { refreshPermissions } = useAuth();
  const [refreshingOverrides, setRefreshingOverrides] = useState(false);
  const [refreshingPerms, setRefreshingPerms] = useState(false);

  const load = async () => {
    if(!id) return;
    setRefreshingOverrides(true); setError('');
    try {
      const r = await fetch('/api/admin/users', { credentials: 'include' });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.error || 'Error');
      const found = Array.isArray(j) ? j.find((u: any)=> u._id === id) : null;
      if(!found) throw new Error('Usuario no encontrado');
      setUser(found);
    } catch(e:any){ setError(e?.message||'Error cargando'); }
    finally { setRefreshingOverrides(false); }
  };

  useEffect(()=> { void load(); }, [id]);

  const isAllowed = (perm: string) => !!user?.userOverrides?.allow?.includes(perm);
  const isDenied = (perm: string) => !!user?.userOverrides?.deny?.includes(perm);
  const effective = (perm: string) => isAllowed(perm) ? 'allow' : isDenied(perm) ? 'deny' : 'default';
  const isAdminTarget = user?.role === 'admin';

  const toggle = async (perm: string, mode: 'allow'|'deny'|'clear') => {
    if(!user || !id) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/admin/users/${id}/overrides`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ permission: perm, action: mode }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Error');
      setUser(u => u ? { ...u, userOverrides: data.overrides } : u);
    } catch(e:any){ setError(e?.message||'Error actualizando'); }
    finally { setSaving(false); }
  };

  return (
    <div className="pt-16 px-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Overrides de Usuario</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={()=>navigate(-1)}>Volver</Button>
            <Button variant="outline" disabled={refreshingOverrides} onClick={()=>{ void load(); }}>{refreshingOverrides? 'Actualizando…':'Refrescar overrides'}</Button>
            <Button variant="outline" disabled={refreshingPerms} onClick={async()=>{ setRefreshingPerms(true); try { await refreshPermissions(); } finally { setRefreshingPerms(false); } }}>{refreshingPerms? 'Refrescando…':'Refrescar mis permisos'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-slate-600">Cargando…</div>}
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          {user && (
            <div className="space-y-6">
              <div className="text-sm bg-slate-50 border rounded p-3">
                <div><span className="font-semibold">Nombre:</span> {user.name}</div>
                <div><span className="font-semibold">Email:</span> {user.email}</div>
                <div><span className="font-semibold">Rol:</span> {user.role}</div>
              </div>
              {isAdminTarget && (
                <div className="rounded-md border border-purple-200 bg-purple-50 p-4 text-xs text-purple-800">
                  El rol <strong>admin</strong> posee acceso completo a todo el catálogo de permisos por diseño. No se aplican overrides individuales. Para ajustar accesos, modifica los roles inferiores o crea un rol dedicado (p.ej. "tecnico" / "cliente").
                </div>
              )}
              {PERM_GROUPS.map(g => (
                <div key={g.title} className="border rounded p-4 bg-white">
                  <h3 className="text-sm font-semibold mb-2 text-slate-700 flex items-center gap-2">
                    {g.title}
                    {isAdminTarget && <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">ADMIN (solo lectura)</span>}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {g.keys.map(k => {
                      const state = effective(k);
                      return (
                        <div key={k} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-2 bg-slate-50">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">{k}</span>
                            {isAdminTarget ? (
                              <span className="text-[10px] uppercase tracking-wide text-purple-600">always allow (admin)</span>
                            ) : (
                              <span className={`text-[10px] uppercase tracking-wide ${state==='allow' ? 'text-emerald-600' : state==='deny' ? 'text-red-600' : 'text-slate-500'}`}>{state}</span>
                            )}
                          </div>
                          {!isAdminTarget && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" disabled={saving || state==='allow'} onClick={()=>toggle(k,'allow')}>Permitir</Button>
                              <Button size="sm" variant="outline" disabled={saving || state==='deny'} onClick={()=>toggle(k,'deny')}>Denegar</Button>
                              <Button size="sm" variant="outline" disabled={saving || state==='default'} onClick={()=>toggle(k,'clear')}>Clear</Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-slate-500">Nota: {isAdminTarget ? 'Los overrides se desactivan para admin.' : 'Los overrides aplican al usuario objetivo inmediatamente; usa “Refrescar overrides” para ver cambios externos y "Refrescar mis permisos" si editas tus propios overrides.'}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
