import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend } from 'recharts'
import { useTelemetrySummary } from './telemetry/useTelemetrySummary'

interface VisitRow { ts: string; route: string; userId?: string; role?: string; event?: string; durationMs?: number; sessionId?: string; meta?: any }
type UrlEntry = { urlHash: string; count: number; url: string | null }

export default function AdminTelemetryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [routeFilter, setRouteFilter] = useState<string>('')
  const [days, setDays] = useState<number>(7)
  const summaryApi = useTelemetrySummary(days)
  const [showAllUrls, setShowAllUrls] = useState(false)
  const [urlSearch, setUrlSearch] = useState('')
  const [recentUserSearch, setRecentUserSearch] = useState('')
  const [showAllRecent, setShowAllRecent] = useState(false)

  // Usuarios: búsqueda y ver todas
  const [userSearch, setUserSearch] = useState('')
  const [showAllUsers, setShowAllUsers] = useState(false)

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

  // Normalización para roles dentro de cada microservicio.
  // Admite:
  // - m.byRole = { roleName: count, ... }
  // - m.byRole = [{ role: 'cliente', count: 3 }, ...]
  // - m.roles = same as above
  const normalizeMicroRoles = (m: any): Array<{ role: string; count: number }> => {
    if (!m) return []
    const raw = m.byRole ?? m.roles ?? undefined
    if (!raw) return []
    if (Array.isArray(raw)) {
      return raw.map((x: any) => ({ role: x.role ?? x.name ?? '—', count: Number(x.count ?? x.total ?? 0) }))
    }
    if (typeof raw === 'object') {
      return Object.entries(raw).map(([role, val]) => ({ role, count: typeof val === 'number' ? val : Number((val as any).count ?? (val as any).total ?? 0) }))
    }
    return []
  }

  // Normalización para resumen por rol (traerlo de diag.byRole en cualquiera de los formatos)
  const rolesSummary = useMemo(() => {
    if (!diag) return [] as Array<{ role: string; visits?: number; total: number; byApi?: { performance?: number; security?: number } }>
    const visitsMap = new Map<string, number>((diag.visitsByRole || []).map((v: any) => [v.role, v.visits]))

    if (Array.isArray(diag.byRole)) {
      return diag.byRole.map((r: any) => ({
        role: r.role || '—',
        visits: visitsMap.get(r.role) || 0,
        total: typeof r.total === 'number' ? r.total : (typeof r.count === 'number' ? r.count : 0),
        byApi: r.byApi ? { performance: r.byApi.performance ?? 0, security: r.byApi.security ?? 0 } : undefined
      }))
    }

    if (diag.byRole && typeof diag.byRole === 'object') {
      return Object.entries(diag.byRole).map(([role, val]) => {
        if (typeof val === 'number') {
          return { role, visits: visitsMap.get(role) || 0, total: val, byApi: undefined }
        }
        if (typeof val === 'object' && val !== null) {
          const total = typeof (val as any).total === 'number' ? (val as any).total
            : typeof (val as any).count === 'number' ? (val as any).count
            : 0
          const byApi = (val as any).byApi
            ? { performance: (val as any).byApi.performance ?? 0, security: (val as any).byApi.security ?? 0 }
            : ((typeof (val as any).performance === 'number' || typeof (val as any).security === 'number')
                ? { performance: (val as any).performance ?? 0, security: (val as any).security ?? 0 }
                : undefined)
          return { role, visits: visitsMap.get(role) || 0, total, byApi }
        }
        return { role, visits: visitsMap.get(role) || 0, total: 0, byApi: undefined }
      })
    }

    return [] as any[]
  }, [diag])

  // URLs
  const filteredUrls = useMemo<UrlEntry[]>(() => {
    if (!diag) return []
    let list: UrlEntry[] = diag.byUrl as UrlEntry[] || []
    if (urlSearch.trim()) {
      const q = urlSearch.toLowerCase()
      list = list.filter(u => (u.url || u.urlHash || '').toLowerCase().includes(q))
    }
    return list
  }, [diag, urlSearch])

  const displayedUrls = useMemo<UrlEntry[]>(() => {
    if (!diag) return []
    return showAllUrls ? filteredUrls : filteredUrls.slice(0, 5)
  }, [filteredUrls, showAllUrls, diag])

  // Usuarios: búsqueda y paginación simple (5 por defecto)
  const filteredUsers = useMemo(() => {
    if (!diag) return [] as any[]
    const list = Array.isArray(diag.byUser) ? diag.byUser : []
    if (!userSearch.trim()) return list
    const q = userSearch.toLowerCase()
    return list.filter(u => ((u.name || u.userId || '')).toLowerCase().includes(q))
  }, [diag, userSearch])

  const displayedUsers = useMemo(() => {
    if (!diag) return [] as any[]
    return showAllUsers ? filteredUsers : filteredUsers.slice(0, 5)
  }, [filteredUsers, showAllUsers, diag])

  const recentFiltered = useMemo(() => {
    if (!diag) return [] as any[]
    if (!diag.recent) return [] as any[]
    if (!recentUserSearch.trim()) return diag.recent
    const q = recentUserSearch.toLowerCase()
    return diag.recent.filter(r => (r.name || r.userId || '').toLowerCase().includes(q))
  }, [diag, recentUserSearch])
  const recentDisplayed = useMemo(() => showAllRecent ? recentFiltered : recentFiltered.slice(0, 5), [recentFiltered, showAllRecent])

  // Handler: al hacer click en una URL navegamos al detalle (query param urlHash)
  const onClickUrlRow = (u: UrlEntry) => {
    navigate(`/admin/telemetry?urlHash=${encodeURIComponent(u.urlHash)}`)
  }

  return (
    <div className="pt-16 px-4 w-full">
      {diag && (
        <div className="mb-10 space-y-6">
          {/* Controles de rango */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-slate-600 font-medium">Resumen últimos {days} día{days !== 1 ? 's' : ''}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-500">Rango:</label>
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value) || 7)}
                className="border rounded px-2 py-1 text-sm"
              >
                {[1, 3, 7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} día{d !== 1 ? 's' : ''}</option>)}
              </select>
              <button
                onClick={() => summaryApi.reload(days)}
                className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
                disabled={summaryApi.loading}
              >{summaryApi.loading ? 'Cargando…' : 'Recargar'}</button>
            </div>
          </div>

          {/* KPI cards restored (six cards) */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Diagnósticos totales (global)</div>
              <div className="text-xl font-semibold">{diag.total ?? 0}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Tiempo promedio de Diagnósticos</div>
              <div className="text-xl font-semibold">{diag.avgTotalMs ? Math.round(diag.avgTotalMs/1000)+'s' : '—'}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Emails enviados</div>
              <div className="text-xl font-semibold">{summaryApi.data?.emails.totalSent ?? 0}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Emails fallidos</div>
              <div className="text-xl font-semibold text-red-600">{summaryApi.data?.emails.failures ?? 0}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Envíos con PDF</div>
              <div className="text-xl font-semibold">{diag.pdf?.withPdf ?? 0}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Tamaño medio PDF</div>
              <div className="text-xl font-semibold">{diag.pdf?.avgPdfSizeKb ? Math.round(diag.pdf.avgPdfSizeKb)+' KB' : '—'}</div>
            </div>
          </div>

          {/* Layout: gráfica a la izquierda, "Resumen por rol" a la derecha */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico visitas por rol (ocupa 2 columnas in lg) */}
            <div className="p-4 rounded border bg-white col-span-1 lg:col-span-2">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">Visitas por rol
                <span className="text-[10px] font-normal text-slate-400">(últimos {days} día{days !== 1 ? 's' : ''})</span>
              </h3>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diag.visitsByRole || []} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="role" />
                    <YAxis allowDecimals={false} />
                    <RTooltip />
                    <Legend />
                    <Bar dataKey="visits" name="Visitas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tarjeta lateral: Resumen por rol (vuelve a la derecha de la gráfica) */}
            <div className="p-4 rounded border bg-white col-span-1 lg:col-span-1">
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
                  {rolesSummary.map(v => (
                    <tr key={v.role} className="border-b last:border-0">
                      <td className="py-1 pr-2">{v.role || '—'}</td>
                      <td className="py-1 pr-2 text-right">{v.visits || 0}</td>
                      <td className="py-1 pr-2 text-right">{v.total}</td>
                    </tr>
                  ))}
                  {!rolesSummary.length && <tr><td colSpan={3} className="py-2 text-center text-slate-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ahora la tarjeta de Diagnósticos por microservicios queda debajo (ancho completo, igual que otras tarjetas) */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Diagnósticos por microservicios</h3>
              <ul className="text-xs space-y-4 max-h-[420px] overflow-auto pr-1">
                {(diag.micros || []).map((m: any) => {
                  const roles = normalizeMicroRoles(m)
                  return (
                    <li key={m.micro} className="flex flex-col border-b pb-3 last:border-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{m.micro}</div>
                          <div className="text-[11px] text-slate-500">
                            {m.avgMs ? Math.round(m.avgMs) + 'ms' : '—'} · {m.count ?? 0} inv. · {m.failCount ?? 0} fallos
                          </div>
                        </div>
                        <div className="text-sm text-slate-800">{m.count ?? 0}</div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {roles.length ? roles.map(r => (
                          <span key={r.role} className="text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {r.role}: {r.count}
                          </span>
                        )) : (
                          <span className="text-[11px] text-slate-400 italic">Sin desglose por rol</span>
                        )}
                      </div>
                    </li>
                  )
                })}
                {!(diag.micros || []).length && <li className="text-slate-400">Sin datos</li>}
              </ul>
            </div>
          </div>

          {/* Usuarios (debajo, ocupa ancho completo) */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded border bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium">Diagnósticos por usuarios</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar usuario..." className="border rounded px-2 py-1 text-xs" />
                  <button onClick={() => setShowAllUsers(s => !s)} className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50">{showAllUsers ? 'Ver menos' : 'Ver todas'}</button>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 mb-2">Mostrando {displayedUsers.length} de {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-1 pr-2">Usuario</th>
                    <th className="py-1 pr-2 text-right">Diagnosticos</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsers.map((u: any) => (
                    <tr key={u.userId || (u.name + u.count)} className="border-b last:border-0">
                      <td className="py-1 pr-2 truncate max-w-[240px]" title={u.name || u.userId}>{u.name || u.userId || '—'}</td>
                      <td className="py-1 pr-2 text-right">{u.count}</td>
                    </tr>
                  ))}
                  {!displayedUsers.length && <tr><td colSpan={2} className="py-2 text-center text-slate-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* URLs Top (toggle) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="p-4 rounded border bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium">Diagnósticos por URL</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={urlSearch} onChange={e => setUrlSearch(e.target.value)} placeholder="Buscar URL..." className="border rounded px-2 py-1 text-xs" />
                  <button onClick={() => setShowAllUrls(s => !s)} className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50">{showAllUrls ? 'Ver menos' : 'Ver todas'}</button>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mb-2">Mostrando {displayedUrls.length} de {filteredUrls.length} URL{filteredUrls.length !== 1 ? 's' : ''}{diag?.missingUrlCount ? ` (+${diag.missingUrlCount} sin URL)` : ''}</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-1 pr-2">URL</th>
                    <th className="py-1 pr-2 text-right">Diagnosticos</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUrls.map((u: UrlEntry) => (
                    <tr
                      key={u.urlHash}
                      className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => onClickUrlRow(u)}
                      title="Ver diagnósticos filtrados por esta URL"
                    >
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
          </div>

          {/* Diagnósticos recientes */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded border bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium flex items-center gap-2">Diagnósticos recientes
                  <span className="text-[10px] font-normal text-slate-400" title="Últimos diagnósticos completados en el rango solicitado (orden cronológico inverso).">info</span>
                </h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={recentUserSearch} onChange={e => setRecentUserSearch(e.target.value)} placeholder="Buscar usuario..." className="border rounded px-2 py-1 text-xs" />
                  <button onClick={() => setShowAllRecent(s => !s)} className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50">{showAllRecent ? 'Ver menos' : 'Ver más'}</button>
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
                  {recentDisplayed.map((r: any) => (
                    <tr key={r.ts + (r.userId || '') + (r.url || '')} className="border-b last:border-0">
                      <td className="py-1 pr-2 whitespace-nowrap" title={new Date(r.ts).toLocaleString()}>{new Date(r.ts).toLocaleTimeString()}</td>
                      <td className="py-1 pr-2 truncate max-w-[140px]" title={r.name || r.userId || ''}>{r.name || r.userId || '—'}</td>
                      <td className="py-1 pr-2">{r.role || '—'}</td>
                      <td className="py-1 pr-2 truncate max-w-[240px]" title={r.url || ''}>{r.url || '—'}</td>
                      <td className="py-1 pr-2 text-right" title={r.durationMs ? r.durationMs + ' ms' : ''}>{r.durationMs ? Math.round(r.durationMs / 1000) + 's' : '—'}</td>
                    </tr>
                  ))}
                  {!recentDisplayed.length && <tr><td colSpan={5} className="py-2 text-center text-slate-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Errores por categoría */}
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded border bg-white">
              <h3 className="text-sm font-medium mb-2">Errores por categoría</h3>
              <ul className="text-xs space-y-1 max-h-56 overflow-auto pr-1">
                {diag.errors.byCategory.map((e: any) => (
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