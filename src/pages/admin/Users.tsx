import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'

// Minimal placeholder functional view, ready to wire to backend later
export default function AdminUsersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [users, setUsers] = useState<Array<{ _id: string; name: string; email: string; role: string; isActive?: boolean }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // TODO: Replace with real backend endpoint when ready
    setLoading(true)
    ;(async () => {
      try {
        const r = await fetch('/api/admin/users', { credentials: 'include' })
        const t = await r.text()
        const data = (() => { try { return JSON.parse(t) } catch { return [] } })()
        if (!r.ok) throw new Error(data?.error || `Error ${r.status}`)
        setUsers(Array.isArray(data) ? data : [])
      } catch (e: any) {
        setError(e?.message || 'Error cargando usuarios')
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

  return (
    <div className="pt-16 px-4 max-w-5xl mx-auto">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Usuarios</CardTitle>
          <Button variant="outline" onClick={goBack}>Volver</Button>
        </CardHeader>
        <CardContent>
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
          {loading && <div className="text-slate-600 text-sm">Cargando…</div>}
          {!loading && users.length === 0 && <div className="text-slate-600 text-sm">Sin usuarios por mostrar.</div>}

          {users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 px-3">Nombre</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Rol</th>
                    <th className="py-2 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-b last:border-0">
                      <td className="py-2 px-3">{u.name}</td>
                      <td className="py-2 px-3">{u.email}</td>
                      <td className="py-2 px-3"><span className="px-2 py-1 rounded bg-slate-100 text-slate-700">{u.role}</span></td>
                      <td className="py-2 px-3">{u.isActive === false ? 'Inactivo' : 'Activo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
