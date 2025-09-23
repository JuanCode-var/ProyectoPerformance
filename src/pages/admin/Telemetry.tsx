import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend } from 'recharts'
import { Info } from 'lucide-react'

interface VisitRow { ts: string; route: string; userId?: string; role?: string; event?: string; durationMs?: number; sessionId?: string; meta?: any }

type Summary = {
  route: string;
  views: number;
  avgMs: number;
  sessions: number;
  events: number;
}

export default function AdminTelemetryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [routeFilter, setRouteFilter] = useState<string>('')

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

  const summary = useMemo(() => {
    const map = new Map<string, { views: number; timeMs: number; sessions: Set<string>; events: number }>()
    for (const v of visits) {
      const route = v.route
      if (routeFilter && !route.includes(routeFilter)) continue
      if (!map.has(route)) map.set(route, { views: 0, timeMs: 0, sessions: new Set(), events: 0 })
      const acc = map.get(route)!
      if (v.event === 'route_view') acc.views += 1
      if (v.event === 'route_leave' && typeof v.durationMs === 'number') acc.timeMs += v.durationMs
      if (v.sessionId) acc.sessions.add(v.sessionId)
      if (v.event === 'client_event') acc.events += 1
    }
    const rows: Summary[] = []
    for (const [route, acc] of map.entries()) {
      rows.push({ route, views: acc.views, avgMs: acc.views ? Math.round(acc.timeMs / acc.views) : 0, sessions: acc.sessions.size, events: acc.events })
    }
    return rows.sort((a,b)=> b.views - a.views)
  }, [visits, routeFilter])

  const recent = useMemo(() => {
    return visits.filter(v => !routeFilter || v.route.includes(routeFilter)).slice(0, 200)
  }, [visits, routeFilter])

  const topSummary = useMemo(() => summary.slice(0, 10), [summary])

  const tickFormatter = (v: any) => (typeof v === 'string' && v.length > 18 ? v.slice(0, 18) + '…' : v)

  // KPIs agregados (globales con filtro de ruta)
  const kpis = useMemo(() => {
    let views = 0
    let timeMs = 0
    const sessions = new Set<string>()
    let events = 0
    for (const v of visits) {
      if (routeFilter && !v.route.includes(routeFilter)) continue
      if (v.event === 'route_view') views += 1
      if (v.event === 'route_leave' && typeof v.durationMs === 'number') timeMs += v.durationMs
      if (v.sessionId) sessions.add(v.sessionId)
      if (v.event === 'client_event') events += 1
    }
    const avgMs = views ? Math.round(timeMs / views) : 0
    return { views, avgMs, sessions: sessions.size, events }
  }, [visits, routeFilter])

  // Helpers para badges y etiquetas
  const getSeverity = (v: VisitRow): string | undefined => {
    const sev = v?.meta?.severity || v?.meta?.level || v?.meta?.type
    if (!sev) return undefined
    return String(sev).toLowerCase()
  }

  const sevClasses = (sev?: string) => {
    switch (sev) {
      case 'error':
        return 'bg-red-100 text-red-700'
      case 'warn':
      case 'warning':
        return 'bg-yellow-100 text-yellow-700'
      case 'success':
        return 'bg-green-100 text-green-700'
      case 'info':
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const eventBadge = (ev?: string) => {
    const base = 'px-2 py-0.5 rounded text-xs inline-flex items-center'
    if (ev === 'route_view') return <span className={`${base} bg-blue-100 text-blue-700`}>view</span>
    if (ev === 'route_leave') return <span className={`${base} bg-purple-100 text-purple-700`}>leave</span>
    if (ev === 'client_event') return <span className={`${base} bg-slate-100 text-slate-700`}>event</span>
    return <span className={`${base} bg-slate-100 text-slate-700`}>{ev || '-'}</span>
  }

  return (
    <div className="pt-16 px-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Telemetría (Clientes)
            <span
              className="inline-flex items-center text-slate-500 hover:text-slate-700 cursor-help"
              title={
                'Telemetría para tomar decisiones de producto y UX:\n' +
                '• Vistas por ruta → popularidad y navegación.\n' +
                '• Tiempo medio en página → engagement.\n' +
                '• Sesiones únicas → alcance real.\n' +
                '• Eventos → interacción en componentes.\n' +
                'Privacidad: solo se registran rutas, tiempos y eventos anónimos de clientes.'
              }
            >
              <Info size={18} />
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <input
              value={routeFilter}
              onChange={e=>setRouteFilter(e.target.value)}
              placeholder="Filtrar por ruta…"
              className="border rounded px-2 py-1 text-sm"
            />
            <Button
              aria-label="Limpiar telemetría"
              // Usamos "destructive" para asegurar rojo sólido sin que "bg-background" del variant outline lo sobreescriba
              variant={visits.length ? 'destructive' : 'outline'}
              className={visits.length
                ? '!bg-red-600 !border-red-600 !text-white hover:!bg-red-500 hover:!border-red-500 hover:shadow-md hover:-translate-y-0.5'
                : 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200 hover:border-slate-200 hover:translate-y-0 hover:shadow-none !opacity-100'}
              disabled={!visits.length}
              onClick={async ()=>{
                if(!visits.length) return
                if(!confirm('¿Limpiar todos los datos de telemetría?')) return
                try {
                  const r = await fetch('/api/admin/telemetry/clear',{method:'POST',credentials:'include'})
                  if(!r.ok) throw new Error('Error limpiando telemetría')
                  setVisits([])
                } catch(e:any){
                  alert(e.message||'Error')
                }
              }}>Limpiar</Button>
            <Button variant="outline" onClick={goBack}>Volver</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
          {loading && <div className="text-slate-600 text-sm">Cargando…</div>}

          {/* Bloque explicativo */}
          <div className="mb-4 p-3 rounded-lg border bg-slate-50 text-slate-700">
            <div className="font-medium mb-1">¿Por qué es útil?</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Prioriza mejoras según rutas con más vistas y mayor permanencia.</li>
              <li>Detecta fricción: páginas con rebote rápido o sin uso.</li>
              <li>Justifica valor al cliente: qué consultan y cuánto tiempo lo usan.</li>
              <li>Evalúa impacto de cambios: compara niveles antes/después.</li>
            </ul>
            <div className="mt-2 text-xs text-slate-600">
              Consejo: filtra por ruta para analizar flujos específicos (p. ej. /diagnostico, /historico, /admin/telemetry).
            </div>
          </div>

          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Vistas</div>
              <div className="text-xl font-semibold">{kpis.views}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Tiempo medio</div>
              <div className="text-xl font-semibold">{Math.round((kpis.avgMs||0)/1000)}s</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Sesiones</div>
              <div className="text-xl font-semibold">{kpis.sessions}</div>
            </div>
            <div className="p-3 rounded border bg-white">
              <div className="text-xs text-slate-500">Eventos</div>
              <div className="text-xl font-semibold">{kpis.events}</div>
            </div>
          </div>

          {topSummary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="w-full h-[280px] bg-white rounded border">
                <div className="px-3 py-2 text-sm font-medium text-slate-700">Vistas por ruta (Top 10)</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={topSummary} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="route" tickFormatter={tickFormatter} interval={0} height={50} angle={-15} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <RTooltip formatter={(v:any)=>v} labelFormatter={(l:any)=>l} />
                    <Legend />
                    <Bar dataKey="views" name="Vistas" fill="#2563eb" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full h-[280px] bg-white rounded border">
                <div className="px-3 py-2 text-sm font-medium text-slate-700">Tiempo medio por ruta (Top 10)</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={topSummary.map(r => ({ ...r, avgSec: Math.round((r.avgMs||0)/1000) }))} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="route" tickFormatter={tickFormatter} interval={0} height={50} angle={-15} textAnchor="end" />
                    <YAxis allowDecimals={false} />
                    <RTooltip formatter={(v:any)=>`${v}s`} labelFormatter={(l:any)=>l} />
                    <Legend />
                    <Bar dataKey="avgSec" name="Tiempo (s)" fill="#16a34a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Ruta</th>
                  <th className="py-2 px-3">Evento</th>
                  <th className="py-2 px-3">Duración</th>
                  <th className="py-2 px-3">Sesión</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 px-3 whitespace-nowrap">{new Date(v.ts).toLocaleString()}</td>
                    <td className="py-2 px-3">{v.route}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {eventBadge(v.event)}
                        {(() => {
                          const sev = getSeverity(v)
                          return sev ? (
                            <span className={`px-2 py-0.5 rounded text-xs ${sevClasses(sev)}`}>{sev}</span>
                          ) : null
                        })()}
                      </div>
                    </td>
                    <td className="py-2 px-3">{typeof v.durationMs === 'number' ? `${Math.round(v.durationMs/1000)}s` : '-'}</td>
                    <td className="py-2 px-3">{v.sessionId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
