import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend } from 'recharts'
import { Info } from 'lucide-react'
import { useTelemetrySummary } from './telemetry/useTelemetrySummary'

interface VisitRow { ts: string; route: string; userId?: string; role?: string; event?: string; durationMs?: number; sessionId?: string; meta?: any }

export default function AdminTelemetryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [routeFilter, setRouteFilter] = useState<string>('')
  const [days, setDays] = useState<number>(7)
  const summaryApi = useTelemetrySummary(days)
  const [showMicroInfo, setShowMicroInfo] = useState(false)
  const [showAllUrls, setShowAllUrls] = useState(false)
  const [urlSearch, setUrlSearch] = useState('')
  const [recentUserSearch, setRecentUserSearch] = useState('')
  const [showAllRecent, setShowAllRecent] = useState(false)

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try {
        const r = await fetch('/api/admin/telemetry?limit=1000&role=cliente', { credentials: 'include' })
        const t = await r.text()
        const data = (() => { try { return JSON.parse(t) } catch { return [] } })()
        if (!r.ok) throw new Error(data?.error || `Error ${r.status}`)
        setVisits(Array.isArray(data) ? data : [])
      } catch (e: any) {
        setError(e?.message || 'Error cargando telemetría')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const goBack = () => {
    const from = (location.state as any)?.from
    if (from) return navigate(from)
    if (window.history.length > 1) return navigate(-1)
    navigate('/admin')
  }

  const diag = summaryApi.data?.diagnostics

  type UrlEntry = { urlHash: string; count: number; url: string | null }

  const filteredUrls = useMemo<UrlEntry[]>(()=>{
    if(!diag) return []
    let list: UrlEntry[] = diag.byUrl as UrlEntry[]
    if(urlSearch.trim()) {
      const q = urlSearch.toLowerCase()
      list = list.filter(u => (u.url || u.urlHash || '').toLowerCase().includes(q))
    }
    return list
  }, [diag, urlSearch])

  const displayedUrls = useMemo<UrlEntry[]>(()=>{
    if(!diag) return []
    return showAllUrls ? filteredUrls : filteredUrls.slice(0,20)
  }, [filteredUrls, showAllUrls, diag])

  const recentFiltered = useMemo(()=>{
    if(!diag) return [] as any[]
    if(!diag.recent) return [] as any[]
    if(!recentUserSearch.trim()) return diag.recent
    const q = recentUserSearch.toLowerCase()
    return diag.recent.filter(r=> (r.name||r.userId||'').toLowerCase().includes(q))
  }, [diag, recentUserSearch])
  const recentDisplayed = useMemo(()=> showAllRecent ? recentFiltered : recentFiltered.slice(0,5), [recentFiltered, showAllRecent])

  return (
    <div className="pt-16 px-4 max-w-7xl mx-auto">
      {diag && (
        <div className="mb-10 space-y-6">
          {/* Controles de rango */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-slate-600 font-medium">Resumen últimos {days} día{days!==1?'s':''}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-500">Rango:</label>
              <select
                value={days}
                onChange={e=> setDays(Number(e.target.value) || 7)}
                className="border rounded px-2 py-1 text-sm"
              >
                {[1,3,7,14,30,60,90].map(d=> <option key={d} value={d}>{d} día{d!==1?'s':''}</option>)}
              </select>
              <button
                onClick={()=> summaryApi.reload(days)}
                className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
                disabled={summaryApi.loading}
              >{summaryApi.loading? 'Cargando…':'Recargar'}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {/* KPIs principales */}
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500 flex items-center gap-1">Diagnósticos totales (global)
                {/* Tooltip simple via title */}
                <span className="text-[10px] uppercase tracking-wide text-slate-400" title=""></span>
              </div>
              <div className="text-xl font-semibold">{diag.total}</div>
              {/* <div className="text-[11px] text-slate-500 mt-1" title="Número total de invocaciones a microservicios (diagnostic.micro_call).">
                Micro-calls: {diag.microCallsTotal} {diag.total ? <>(≈ {(diag.microCallsTotal/Math.max(1,diag.total)).toFixed(1)} / diag)</> : null}
              </div> */}
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Tiempo promedio de Diagnósticos</div>
              <div className="text-xl font-semibold">{diag.avgTotalMs ? Math.round(diag.avgTotalMs/1000)+'s' : '—'}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Emails enviados</div>
              <div className="text-xl font-semibold">{summaryApi.data?.emails.totalSent}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Emails fallidos</div>
              <div className="text-xl font-semibold text-red-600">{summaryApi.data?.emails.failures}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Envíos con PDF</div>
              <div className="text-xl font-semibold">{diag.pdf.withPdf}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Tamaño medio PDF</div>
              <div className="text-xl font-semibold">{diag.pdf.avgPdfSizeKb ? Math.round(diag.pdf.avgPdfSizeKb)+' KB' : '—'}</div>
            </div>
          </div>

          {/* Gráfico visitas por rol */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-4 rounded border bg-white col-span-1 lg:col-span-2">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">Visitas por rol
                <span className="text-[10px] font-normal text-slate-400">(últimos {days} día{days!==1?'s':''})</span>
              </h3>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diag.visitsByRole || []} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="role" />
                    <YAxis allowDecimals={false} />
                    <RTooltip />
                    <Legend />
                    <Bar dataKey="visits" name="Visitas" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Resumen por rol</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-1 pr-2">Rol</th>
                    <th className="py-1 pr-2 text-right">Visitas</th>
                    <th className="py-1 pr-2 text-right">Diagnosticos</th>
                  </tr>
                </thead>
                <tbody>
                  {(diag.visitsByRole||[]).map(v => (
                    <tr key={v.role} className="border-b last:border-0">
                      <td className="py-1 pr-2">{v.role||'—'}</td>
                      <td className="py-1 pr-2 text-right">{v.visits}</td>
                      <td className="py-1 pr-2 text-right">{diag.byRole[v.role] || 0}</td>
                    </tr>
                  ))}
                  {!diag.visitsByRole?.length && <tr><td colSpan={3} className="py-2 text-center text-slate-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Microservicios */}
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Diagnósticos por microservicios</h3>
              <ul className="text-xs space-y-1 max-h-56 overflow-auto pr-1">
                {diag.micros.map(m => (
                  <li key={m.micro} className="flex justify-between">
                    <span>{m.micro}</span>
                    <span>{Math.round(m.avgMs)}ms · {m.count} ({m.failCount} fallos)</span>
                  </li>
                ))}
                {!diag.micros.length && <li className="text-slate-400">Sin datos</li>}
              </ul>
            </div>
            {/* Micro-calls por diagnóstico (promedio) ahora junto a Microservicios */}
            <div className="p-4 rounded border bg-white relative">
              <h3 className="text-sm font-medium mb-1 flex items-center gap-1">Micro-calls por diagnóstico (promedio)
                <button type="button" onClick={()=> setShowMicroInfo(v=>!v)} className="text-[10px] px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-500" aria-label="Más información">i</button>
              </h3>
              <div className="text-3xl font-semibold flex items-baseline gap-1">
                {diag.total ? (diag.microCallsTotal/diag.total).toFixed(1) : '—'}
                {diag.total ? <span className="text-[10px] font-normal text-slate-500">micro-calls/diag</span> : null}
              </div>
              <p className="text-[11px] mt-1 text-slate-500 leading-snug">Promedio de invocaciones a microservicios.</p>
              {showMicroInfo && (
                <div className="absolute z-10 top-2 right-2 w-72 text-[11px] leading-snug bg-white border rounded shadow p-3">
                  <div className="font-semibold mb-1">¿Qué significa?</div>
                  <p><strong>Micro-call</strong>: una invocación a un microservicio registrada como evento <code className="bg-slate-100 px-1 rounded">diagnostic.micro_call</code>.</p>
                  <p className="mt-1"><strong>Valor</strong>: promedio de micro-calls realizadas dentro de cada diagnóstico completado (<code className="bg-slate-100 px-1 rounded">diagnostic.end</code>).</p>
                  <p className="mt-1">Ejemplo: 1.2 micro-calls/diag = cada diagnóstico ejecutó en promedio 1.2 llamadas a microservicios. &gt;1 indica uso de múltiples microservicios.</p>
                  <button onClick={()=> setShowMicroInfo(false)} className="mt-2 text-[10px] px-2 py-1 border rounded bg-slate-50 hover:bg-slate-100">Cerrar</button>
                </div>
              )}
            </div>
            {/* Diagnósticos por rol */}
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Diagnósticos por rol</h3>
              <ul className="text-xs space-y-1">
                {Object.entries(diag.byRole).map(([role, count]) => (
                  <li key={role} className="flex justify-between"><span>{role||'—'}</span><span>{count}</span></li>
                ))}
                {!Object.keys(diag.byRole).length && <li className="text-slate-400">Sin datos</li>}
              </ul>
            </div>
            {/* Usuarios Top */}
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Diagnósticos por usuarios</h3>
              <ul className="text-xs space-y-1 max-h-56 overflow-auto pr-1">
                {diag.byUser.slice(0,8).map(u => (
                  <li key={u.userId} className="flex justify-between">
                    <span className="truncate max-w-[120px]" title={u.name || u.userId}>{u.name || u.userId}</span>
                    <span>{u.count}</span>
                  </li>
                ))}
                {!diag.byUser.length && <li className="text-slate-400">Sin datos</li>}
              </ul>
            </div>
          </div>

          {/* URLs Top */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="p-4 rounded border bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium">Diagnósticos por URL</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={urlSearch} onChange={e=> setUrlSearch(e.target.value)} placeholder="Buscar URL..." className="border rounded px-2 py-1 text-xs" />
                  <button onClick={()=> setShowAllUrls(s=>!s)} className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50">{showAllUrls? 'Ver menos' : 'Ver todas'}</button>
                  {/* Exportar CSV eliminado */}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mb-2">Mostrando {displayedUrls.length} de {filteredUrls.length} URL{filteredUrls.length!==1?'s':''}{filteredUrls.length!==filteredUrls.length? '' : ''}{diag?.missingUrlCount ? ` (+${diag.missingUrlCount} sin URL)` : ''}</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-1 pr-2">URL</th>
                    <th className="py-1 pr-2 text-right">Diagnosticos</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUrls.map((u: UrlEntry) => (
                    <tr key={u.urlHash} className="border-b last:border-0">
                      <td className="py-1 pr-2 truncate max-w-[420px]" title={u.url || u.urlHash}>{u.url || u.urlHash}</td>
                      <td className="py-1 pr-2 text-right">{u.count}</td>
                    </tr>
                  ))}
                  {!!diag?.missingUrlCount && (!urlSearch || '(sin url)'.includes(urlSearch.toLowerCase())) && (
                    <tr className="border-b last:border-0">
                      <td className="py-1 pr-2 text-slate-500 italic" title="Diagnósticos sin URL capturada">(sin URL)</td>
                      <td className="py-1 pr-2 text-right">{diag.missingUrlCount}</td>
                    </tr>
                  )}
                  {!displayedUrls.length && !diag?.missingUrlCount && <tr><td colSpan={2} className="py-2 text-center text-slate-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
            {/* (Espacio reservado o futura tarjeta) */}
          </div>

          {/* Diagnósticos recientes (usuarios y URLs) */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded border bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium flex items-center gap-2">Diagnósticos recientes
                  <span className="text-[10px] font-normal text-slate-400" title="Últimos diagnósticos completados en el rango solicitado (orden cronológico inverso).">info</span>
                </h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={recentUserSearch} onChange={e=> setRecentUserSearch(e.target.value)} placeholder="Buscar usuario..." className="border rounded px-2 py-1 text-xs" />
                  <button onClick={()=> setShowAllRecent(s=>!s)} className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50">{showAllRecent? 'Ver menos' : 'Ver más'}</button>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mb-2">Mostrando {recentDisplayed.length} de {recentFiltered.length} diagnósticos recientes</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-1 pr-2">Fecha</th>
                    <th className="py-1 pr-2">Usuario</th>
                    <th className="py-1 pr-2">Rol</th>
                    <th className="py-1 pr-2">URL</th>
                    <th className="py-1 pr-2 text-right">Durac.</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDisplayed.map(r => (
                    <tr key={r.ts + (r.userId||'') + (r.url||'')} className="border-b last:border-0">
                      <td className="py-1 pr-2 whitespace-nowrap" title={new Date(r.ts).toLocaleString()}>{new Date(r.ts).toLocaleTimeString()}</td>
                      <td className="py-1 pr-2 truncate max-w-[140px]" title={r.name || r.userId || ''}>{r.name || r.userId || '—'}</td>
                      <td className="py-1 pr-2">{r.role || '—'}</td>
                      <td className="py-1 pr-2 truncate max-w-[240px]" title={r.url || ''}>{r.url || '—'}</td>
                      <td className="py-1 pr-2 text-right" title={r.durationMs ? r.durationMs+' ms': ''}>{r.durationMs ? Math.round(r.durationMs/1000)+'s' : '—'}</td>
                    </tr>
                  ))}
                  {!recentDisplayed.length && <tr><td colSpan={5} className="py-2 text-center text-slate-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Errores por categoría al final */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Errores por categoría</h3>
              <ul className="text-xs space-y-1 max-h-56 overflow-auto pr-1">
                {diag.errors.byCategory.map(e => (
                  <li key={e.errorCategory} className="flex justify-between">
                    <span>{e.errorCategory}</span>
                    <span>{e.count}</span>
                  </li>
                ))}
                {!diag.errors.byCategory.length && <li className="text-slate-400">Sin datos</li>}
              </ul>
              <p className="mt-3 text-[10px] leading-snug text-slate-500">Incluye solo errores de micro-calls (eventos diagnostic.micro_call con success=false) agrupados por categoría de error (errorCategory). No incluye errores de otras fases.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
