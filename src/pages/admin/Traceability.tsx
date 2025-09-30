import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Info, RefreshCw } from 'lucide-react'

interface AuditRow { ts: string; targetUserId: string; targetUserName: string | null; previousRole: string | null; newRole: string | null; changedById: string; changedByName: string | null; note?: string | null }

export default function TraceabilityPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [days, setDays] = useState(30)
  const [filter, setFilter] = useState('')
  const [reason, setReason] = useState('')

  const load = async (d = days) => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/admin/role-audit?days=${encodeURIComponent(d)}`, { credentials: 'include' })
      const t = await r.text(); const j = (()=>{ try { return JSON.parse(t) } catch { return null } })()
      if(!r.ok) throw new Error(j?.error || `Error ${r.status}`)
      setRows(j?.items || [])
    } catch(e:any){ setError(e?.message || 'Error cargando trazabilidad') } finally { setLoading(false) }
  }
  useEffect(()=>{ load(days) },[days])

  const goBack = () => {
    if (window.history.length > 1) return navigate(-1)
    navigate('/admin')
  }

  const filtered = rows.filter(r => {
    const q = filter.trim().toLowerCase(); const rs = reason.trim()
    if(q && !(
      (r.targetUserName||'').toLowerCase().includes(q) ||
      (r.changedByName||'').toLowerCase().includes(q) ||
      (r.previousRole||'').toLowerCase().includes(q) ||
      (r.newRole||'').toLowerCase().includes(q)
    )) return false
    if(rs) {
      if(rs === 'delete:' && !(r.note||'').startsWith('delete:')) return false
      else if(rs === 'deactivate:' && !(r.note||'').startsWith('deactivate:')) return false
      else if(['baja_voluntaria','inactividad','duplicado','fraude','otro'].includes(rs)) {
        if(!(r.note||'').includes(rs)) return false
      } else if(rs === 'role_changed') {
        if((r.note||'') && !(r.note||'').includes('role_changed')) return false
        if(r.previousRole === r.newRole) return false
      }
    }
    return true
  })

  return (
    <div className="pt-16 px-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">Modo Trazabilidad
            <span
              className="inline-flex items-center text-slate-500 hover:text-slate-700 cursor-help"
              title={'Registro de cambios críticos de usuarios: cambios de rol y eliminaciones. Cada evento mantiene quién realizó la acción, el rol anterior/nuevo, fecha y motivo (nota).'}
            >
              <Info size={18} />
            </span>
          </CardTitle>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              <select value={days} onChange={e=>setDays(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
                {[7,15,30,60,90,180,365].map(d=> <option key={d} value={d}>{d}d</option>)}
              </select>
              <input placeholder="Buscar usuario/rol" value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded px-2 py-1 text-sm w-40" />
              <select value={reason} onChange={e=>setReason(e.target.value)} className="border rounded px-2 py-1 text-sm w-40">
                <option value="">Motivo (todos)</option>
                <option value="delete:">Eliminaciones</option>
                <option value="deactivate:">Desactivaciones (legacy)</option>
                <option value="role_changed">Cambios rol (sin nota)</option>
                <option value="baja_voluntaria">baja_voluntaria</option>
                <option value="inactividad">inactividad</option>
                <option value="duplicado">duplicado</option>
                <option value="fraude">fraude</option>
                <option value="otro">otro</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={()=>load(days)} aria-label="Recargar" title="Recargar"><RefreshCw size={16} className={loading? 'animate-spin':''} /></Button>
              <Button variant="outline" onClick={goBack}>Volver</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
          {loading && <div className="text-slate-600 text-sm">Cargando…</div>}
          <div className="mb-4 p-3 rounded-lg border bg-slate-50 text-slate-700 text-xs leading-relaxed">
            <span className="font-semibold">¿Qué se registra?</span> Cambios de rol y eliminaciones definitivas. Formato nota: delete:motivo | deactivate:motivo | role_changed (implícito si hay cambio de rol sin nota).
          </div>
          {filtered.length === 0 && !loading && <div className="text-slate-600 text-sm">Sin eventos.</div>}
          {filtered.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100/70">
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 px-3 font-medium">Fecha</th>
                    <th className="py-2 px-3 font-medium">Hora</th>
                    <th className="py-2 px-3 font-medium">Usuario</th>
                    <th className="py-2 px-3 font-medium">Rol previo</th>
                    <th className="py-2 px-3 font-medium">Rol nuevo</th>
                    <th className="py-2 px-3 font-medium">Acción por</th>
                    <th className="py-2 px-3 font-medium">Nota / Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i)=>{
                    const d = new Date(r.ts); const fecha = d.toLocaleDateString(); const hora = d.toLocaleTimeString();
                    const note = r.note || (r.previousRole!==r.newRole ? 'role_changed' : '—');
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-3 whitespace-nowrap">{fecha}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-xs">{hora}</td>
                        <td className="py-2 px-3">{r.targetUserName || r.targetUserId}</td>
                        <td className="py-2 px-3">{r.previousRole || '—'}</td>
                        <td className="py-2 px-3">{r.newRole || '—'}</td>
                        <td className="py-2 px-3">{r.changedByName || r.changedById}</td>
                        <td className="py-2 px-3 text-xs">{note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
