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
  { title: 'Performance - Cambio de estrategia', keys: ['performance.change_strategy'], description: 'Permite cambiar entre móvil y ordenador en los diagnósticos.' },
];

// Accordion interactivo para grupos de permisos
function PermGroupAccordion({ title, icon, badge, children, defaultOpen = false }: { title: string, icon: string, badge?: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border-2 border-slate-200 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-sm mb-4 transition-all ${open ? 'ring-2 ring-blue-200' : ''}`}> 
      <button type="button" className="w-full flex items-center justify-between px-4 py-3 focus:outline-none group" onClick={()=>setOpen(v=>!v)}>
        <div className="flex items-center gap-2 text-base font-semibold text-slate-700">
          <span className="text-xl">{icon}</span> {title} {badge}
        </div>
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

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
  // Cambia la lógica de effective para el rol cliente: todo denegado salvo que esté en allow
  const effective = (perm: string) => {
    if (user?.role === 'cliente' && !isAllowed(perm)) return 'deny';
    return isAllowed(perm) ? 'allow' : isDenied(perm) ? 'deny' : 'default';
  };
  const isAdminTarget = user?.role === 'admin';
  const isOperarioOrTecnico = user?.role === 'operario' || user?.role === 'técnico';

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
                <div className="rounded-md border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-100 p-4 text-xs text-purple-900 flex items-center gap-2 shadow animate-fade-in">
                  <span className="text-lg">👑</span>
                  <span>El rol <strong>admin</strong> posee acceso completo a todo el catálogo de permisos por diseño. No se aplican overrides individuales. Para ajustar accesos, modifica los roles inferiores o crea un rol dedicado (p.ej. "tecnico" / "cliente").</span>
                </div>
              )}
              {(isOperarioOrTecnico && !isAdminTarget) && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center gap-2 animate-fade-in">
                  <span className="text-lg">🛠️</span>
                  <span>Los roles <strong>operario</strong> y <strong>técnico</strong> tienen <strong>todos los permisos habilitados por defecto</strong>. Solo puedes <strong>deshabilitar</strong> permisos usando "Denegar". El botón "Permitir" está deshabilitado porque ya tienen acceso total por defecto.</span>
                </div>
              )}
              {user?.role === 'cliente' && !isAdminTarget && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <span>El rol <strong>cliente</strong> tiene acceso solo de <strong>lectura</strong> a los diagnósticos y no puede modificar permisos ni configuraciones avanzadas.</span>
                </div>
              )}

              {/* Tarjeta Seguridad */}
              <PermGroupAccordion
                title="Seguridad - Desgloses (detalle headers, cookies, findings, plan)"
                icon="🛡️"
                badge={isAdminTarget ? <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium ml-2">ADMIN (solo lectura)</span> : isOperarioOrTecnico ? <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium ml-2">OPERARIO/TÉCNICO (acceso total por defecto)</span> : user?.role === 'cliente' ? <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium ml-2">CLIENTE (solo lectura)</span> : null}
                defaultOpen
              >
                <div className="flex flex-col gap-2">
                  {PERM_GROUPS[0].keys.map(k => {
                    const state = effective(k);
                    return (
                      <div key={k} className={`flex items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2 bg-white/80 shadow-sm transition-all ${state==='allow' ? 'border-emerald-300 bg-emerald-50/60' : state==='deny' ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 flex items-center gap-1">{k} {state==='allow' && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 ml-1" title="Permitido"></span>} {state==='deny' && <span className="inline-block w-2 h-2 rounded-full bg-red-400 ml-1" title="Denegado"></span>}</span>
                          {isAdminTarget ? (
                            <span className="text-[10px] uppercase tracking-wide text-purple-600">always allow (admin)</span>
                          ) : isOperarioOrTecnico ? (
                            <span className={`text-[10px] uppercase tracking-wide ${state==='deny' ? 'text-red-600' : 'text-emerald-600'}`}>{state==='deny' ? 'DENY (OVERRIDE)' : 'ALLOW (POR DEFECTO)'}</span>
                          ) : user?.role === 'cliente' && state !== 'allow' ? (
                            <span className="text-[10px] uppercase tracking-wide text-blue-600">SOLO LECTURA</span>
                          ) : (
                            <span className={`text-[10px] uppercase tracking-wide ${state==='allow' ? 'text-emerald-600' : state==='deny' ? 'text-red-600' : 'text-slate-500'}`}>{state}</span>
                          )}
                        </div>
                        {!isAdminTarget && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={saving || state==='allow' || isOperarioOrTecnico} onClick={()=>toggle(k,'allow')}>Permitir</Button>
                            <Button size="sm" variant="outline" disabled={saving || state==='deny'} onClick={()=>toggle(k,'deny')}>Denegar</Button>
                            <Button size="sm" variant="outline" disabled={saving || state==='default'} onClick={()=>toggle(k,'clear')}>Clear</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </PermGroupAccordion>

              {/* Tarjeta Performance (desgloses + plan de acción) */}
              <PermGroupAccordion
                title="Performance (desgloses y plan de acción)"
                icon="⚡"
                badge={isAdminTarget ? <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium ml-2">ADMIN (solo lectura)</span> : isOperarioOrTecnico ? <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium ml-2">OPERARIO/TÉCNICO (acceso total por defecto)</span> : user?.role === 'cliente' ? <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium ml-2">CLIENTE (solo lectura)</span> : null}
              >
                <div className="flex flex-col gap-2">
                  {[...PERM_GROUPS[1].keys, ...PERM_GROUPS[2].keys].map(k => {
                    const state = effective(k);
                    return (
                      <div key={k} className={`flex items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2 bg-white/80 shadow-sm transition-all ${state==='allow' ? 'border-emerald-300 bg-emerald-50/60' : state==='deny' ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 flex items-center gap-1">{k} {state==='allow' && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 ml-1" title="Permitido"></span>} {state==='deny' && <span className="inline-block w-2 h-2 rounded-full bg-red-400 ml-1" title="Denegado"></span>}</span>
                          {isAdminTarget ? (
                            <span className="text-[10px] uppercase tracking-wide text-purple-600">always allow (admin)</span>
                          ) : isOperarioOrTecnico ? (
                            <span className={`text-[10px] uppercase tracking-wide ${state==='deny' ? 'text-red-600' : 'text-emerald-600'}`}>{state==='deny' ? 'DENY (OVERRIDE)' : 'ALLOW (POR DEFECTO)'}</span>
                          ) : user?.role === 'cliente' && state !== 'allow' ? (
                            <span className="text-[10px] uppercase tracking-wide text-blue-600">SOLO LECTURA</span>
                          ) : (
                            <span className={`text-[10px] uppercase tracking-wide ${state==='allow' ? 'text-emerald-600' : state==='deny' ? 'text-red-600' : 'text-slate-500'}`}>{state}</span>
                          )}
                        </div>
                        {!isAdminTarget && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={saving || state==='allow' || isOperarioOrTecnico} onClick={()=>toggle(k,'allow')}>Permitir</Button>
                            <Button size="sm" variant="outline" disabled={saving || state==='deny'} onClick={()=>toggle(k,'deny')}>Denegar</Button>
                            <Button size="sm" variant="outline" disabled={saving || state==='default'} onClick={()=>toggle(k,'clear')}>Clear</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Permiso para cambio de estrategia */}
                  {PERM_GROUPS[3].keys.map(k => {
                    const state = effective(k);
                    return (
                      <div key={k} className={`flex items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2 bg-white/80 shadow-sm transition-all ${state==='allow' ? 'border-emerald-300 bg-emerald-50/60' : state==='deny' ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 flex items-center gap-1">{k} {state==='allow' && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 ml-1" title="Permitido"></span>} {state==='deny' && <span className="inline-block w-2 h-2 rounded-full bg-red-400 ml-1" title="Denegado"></span>}</span>
                          <span className="text-[10px] text-slate-500">Permite cambiar entre móvil y ordenador en los diagnósticos.</span>
                          {isAdminTarget ? (
                            <span className="text-[10px] uppercase tracking-wide text-purple-600">always allow (admin)</span>
                          ) : isOperarioOrTecnico ? (
                            <span className={`text-[10px] uppercase tracking-wide ${state==='deny' ? 'text-red-600' : 'text-emerald-600'}`}>{state==='deny' ? 'DENY (OVERRIDE)' : 'ALLOW (POR DEFECTO)'}</span>
                          ) : user?.role === 'cliente' && state !== 'allow' ? (
                            <span className="text-[10px] uppercase tracking-wide text-blue-600">SOLO LECTURA</span>
                          ) : (
                            <span className={`text-[10px] uppercase tracking-wide ${state==='allow' ? 'text-emerald-600' : state==='deny' ? 'text-red-600' : 'text-slate-500'}`}>{state}</span>
                          )}
                        </div>
                        {!isAdminTarget && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={saving || state==='allow' || isOperarioOrTecnico} onClick={()=>toggle(k,'allow')}>Permitir</Button>
                            <Button size="sm" variant="outline" disabled={saving || state==='deny'} onClick={()=>toggle(k,'deny')}>Denegar</Button>
                            <Button size="sm" variant="outline" disabled={saving || state==='default'} onClick={()=>toggle(k,'clear')}>Clear</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </PermGroupAccordion>

              <div className="text-[10px] text-slate-500">Nota: {isAdminTarget ? 'Los overrides se desactivan para admin.' : isOperarioOrTecnico ? 'Operario y técnico tienen todos los permisos por defecto; solo puedes denegar permisos.' : 'Los overrides aplican al usuario objetivo inmediatamente; usa “Refrescar overrides” para ver cambios externos y "Refrescar mis permisos" si editas tus propios overrides.'}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
