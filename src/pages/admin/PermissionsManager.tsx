import React from 'react';
import { useRolePermissions, ALL_ROLES } from '../../hooks/useRolePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Checkbox } from '../../shared/ui/checkbox';
import { Info } from 'lucide-react';

export default function PermissionsManagerPage() {
  const { catalog, role, setRole, permissions, toggle, selectAllGroup, unselectAllGroup, save, reset, loading, error, dirty, diff } = useRolePermissions('tecnico');

  const groups = Array.from(new Set(catalog.map(c=>c.group)));
  const grouped = groups.map(g => ({ group: g, items: catalog.filter(c=>c.group===g).sort((a,b)=> a.label.localeCompare(b.label)) }));

  return (
    <div className="pt-16 px-4 max-w-7xl mx-auto">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">Gestor de Permisos
            <span className="inline-flex items-center text-slate-500 cursor-help" title="Administra permisos granulares por rol. Cambios impactan inmediatamente."><Info size={18}/></span>
          </CardTitle>
          <div className="flex gap-2 items-center">
            <select value={role} onChange={e=> setRole(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
              {ALL_ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
            </select>
            <Button variant="outline" onClick={()=>reset()} disabled={role==='admin' || loading}>Reset defaults</Button>
            <Button onClick={async()=>{ try { const r = await save(); if(r) {/* TODO toast */} } catch(e:any){/* TODO error */} }} disabled={!dirty || role==='admin' || loading}>Guardar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
          {role==='admin' && <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">El rol admin siempre posee todos los permisos (lectura).
          </div>}
          {dirty && (
            <div className="mb-4 text-xs bg-blue-50 border border-blue-200 p-3 rounded flex flex-col gap-1">
              <div><strong>Cambios pendientes:</strong></div>
              {diff.added.length>0 && <div className="text-green-700">+ {diff.added.length} añadidos</div>}
              {diff.removed.length>0 && <div className="text-red-700">- {diff.removed.length} removidos</div>}
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.map(g=> (
              <div key={g.group} className="border rounded p-3 bg-white flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">{g.group}</h3>
                  <div className="flex gap-1">
                    <button className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200" onClick={()=>selectAllGroup(g.group)}>All</button>
                    <button className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200" onClick={()=>unselectAllGroup(g.group)}>None</button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 overflow-auto max-h-72 pr-1">
                  {g.items.map(it => {
                    const checked = permissions.includes(it.key);
                    return (
                      <label key={it.key} className="flex items-start gap-2 text-xs">
                        <Checkbox checked={checked} disabled={role==='admin'} onCheckedChange={()=>toggle(it.key)} />
                        <span className="leading-tight">
                          <span className="font-medium text-slate-700">{it.label}</span>
                          <span className="block text-[10px] text-slate-500 break-all">{it.key}</span>
                          {it.critical && <span className="inline-block text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded mt-1">crítico</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {loading && <div className="mt-4 text-sm text-slate-600">Cargando...</div>}
        </CardContent>
      </Card>
    </div>
  );
}
