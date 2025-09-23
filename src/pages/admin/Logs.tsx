import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Info } from 'lucide-react'

interface LogRow { ts: string; level: 'info'|'warn'|'error'; message: string; context?: any }

export default function AdminLogsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [level, setLevel] = useState<string>('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try {
        const r = await fetch('/api/admin/logs?limit=300', { credentials: 'include' })
        const t = await r.text()
        const data = (() => { try { return JSON.parse(t) } catch { return [] } })()
        if (!r.ok) throw new Error(data?.error || `Error ${r.status}`)
        setLogs(Array.isArray(data) ? data : [])
      } catch (e: any) {
        setError(e?.message || 'Error cargando logs')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const goBack = () => {
    if (window.history.length > 1) return navigate(-1)
    navigate('/admin')
  }

  const filtered = logs.filter(l => !level || l.level === level)

  return (
    <div className="pt-16 px-4 max-w-5xl mx-auto">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Registros / Logs
            <span
              className="inline-flex items-center text-slate-500 hover:text-slate-700 cursor-help"
              title={
                'Por qué es útil:\n' +
                '• Diagnóstico de errores y rendimiento.\n' +
                '• Auditoría de acciones del sistema.\n' +
                '• Detección temprana de anomalías.\n' +
                'Niveles: info (ruido controlado), warn (revisar), error (acción inmediata).'
              }
            >
              <Info size={18} />
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <select value={level} onChange={e=>setLevel(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="">Todos</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            <Button
              aria-label="Limpiar logs"
              variant={logs.length ? 'destructive' : 'outline'}
              className={logs.length
                ? '!bg-red-600 !border-red-600 !text-white hover:!bg-red-500 hover:!border-red-500 hover:shadow-md hover:-translate-y-0.5'
                : 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed hover:bg-slate-200 hover:border-slate-200 hover:translate-y-0 hover:shadow-none !opacity-100'}
              disabled={!logs.length}
              onClick={async ()=>{
                if(!logs.length) return
                if(!confirm('¿Limpiar todos los logs? Esta acción no se puede deshacer.')) return
                try {
                  const r = await fetch('/api/admin/logs/clear',{method:'POST',credentials:'include'})
                  if(!r.ok) throw new Error('Error limpiando logs')
                  setLogs([])
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
              <li>Diagnosticar errores y cuellos de botella de rendimiento.</li>
              <li>Auditar acciones críticas del sistema para trazabilidad.</li>
              <li>Detectar patrones anómalos y anticipar incidentes.</li>
              <li>Facilitar soporte con contexto temporal y severidad.</li>
            </ul>
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-3">
              <span className="font-medium">Leyenda:</span>
              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">info</span>
              <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">warn</span>
              <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">error</span>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Nivel</th>
                    <th className="py-2 px-3">Mensaje</th>
                    <th className="py-2 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, i) => (
                    <React.Fragment key={i}>
                      <tr className="border-b last:border-0">
                        <td className="py-2 px-3 whitespace-nowrap">{new Date(l.ts).toLocaleString()}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs ${l.level==='error'?'bg-red-100 text-red-700':l.level==='warn'?'bg-yellow-100 text-yellow-700':'bg-slate-100 text-slate-700'}`}>{l.level}</span>
                        </td>
                        <td className="py-2 px-3">{l.message}</td>
                        <td className="py-2 px-3">
                          {l.context ? (
                            <button className="text-blue-600 hover:underline text-xs" onClick={() => setOpenIdx(openIdx===i?null:i)}>
                              {openIdx===i ? 'Ocultar' : 'Ver contexto'}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                      {openIdx===i && l.context && (
                        <tr className="bg-slate-50 border-b last:border-0">
                          <td colSpan={4} className="py-2 px-3">
                            <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(l.context, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading && (
            <div className="text-slate-600 text-sm">Sin registros para mostrar.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
