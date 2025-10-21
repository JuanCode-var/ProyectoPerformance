import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'

// Roles permitidos (sin "otro_tecnico")
const ROLES: Array<{ value: string; label: string; color: string }> = [
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'tecnico', label: 'Técnico', color: 'bg-blue-100 text-blue-700' },
  { value: 'operario', label: 'Operario', color: 'bg-amber-100 text-amber-700' },
  { value: 'cliente', label: 'Cliente', color: 'bg-green-100 text-green-700' }
]

interface UserRow { _id: string; name: string; email: string; role: string; isActive?: boolean; userOverrides?: { allow?: string[]; deny?: string[] } }
interface CurrentUser { id?: string; name?: string }

const LOCAL_DEBUG_KEY = 'roleAudit:debug'
const RETENTION_DAYS = 30
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ name: string; role: string; isActive: boolean }>({ name: '', role: 'cliente', isActive: true })
  const [saving, setSaving] = useState(false)
  const [showDeactivateId, setShowDeactivateId] = useState<string | null>(null)
  const [showDeactivateUser, setShowDeactivateUser] = useState<UserRow | null>(null)
  const [deactReason, setDeactReason] = useState<string>('inactividad')
  const [refreshTick, setRefreshTick] = useState(0)
  const [showReactivateLoadingId, setShowReactivateLoadingId] = useState<string | null>(null)

  // current admin info (used to fill changedByName in audit payloads)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/users', { credentials: 'include' })
      const t = await r.text()
      const data = (() => { try { return JSON.parse(t) } catch { return [] } })()
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`)
      setUsers(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || 'Error cargando usuarios')
    } finally { setLoading(false) }
  }, [])

  // load current admin to use their name in audit payloads
  const loadCurrentUser = useCallback(async () => {
    try {
      const r = await fetch('/api/me', { credentials: 'include' })
      if (!r.ok) return
      const j = await r.json().catch(() => null)
      if (j) setCurrentUser({ id: j.id || j._id || j.userId || undefined, name: j.name || j.displayName || j.email || undefined })
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers, refreshTick])
  useEffect(() => { loadCurrentUser() }, [loadCurrentUser])

  const beginEdit = (u: UserRow) => {
    setEditingId(u._id)
    setForm({ name: u.name || '', role: u.role, isActive: u.isActive !== false })
  }
  const cancelEdit = () => { setEditingId(null) }

  // Helper: prune debug array older than RETENTION_DAYS and keep cap
  const persistDebugArray = (arr: any[]) => {
    const cutoff = Date.now() - RETENTION_MS
    const filtered = arr.filter(e => {
      try {
        const t = Date.parse(e?.at || e?.payload?.ts || '')
        return Number.isFinite(t) ? t >= cutoff : true
      } catch {
        return true
      }
    })
    // keep reasonable cap
    if (filtered.length > 500) filtered.splice(500)
    localStorage.setItem(LOCAL_DEBUG_KEY, JSON.stringify(filtered))
  }

  // Post audit helper: includes changedBy info when possible.
  // If POST fails, persist the attempt into localStorage array.
  const postAudit = async (payload: any) => {
    try {
      // attach changedBy from currentUser if available
      if (currentUser?.name) {
        payload.changedById = payload.changedById ?? currentUser.id ?? undefined
        payload.changedByName = payload.changedByName ?? currentUser.name ?? undefined
      }

      // if still missing changedByName, try /api/me as fallback
      if (!payload.changedByName) {
        try {
          const meResp = await fetch('/api/me', { credentials: 'include' })
          if (meResp.ok) {
            const meJson = await meResp.json().catch(() => null)
            if (meJson) {
              payload.changedById = payload.changedById ?? meJson.id ?? meJson._id ?? meJson.userId ?? undefined
              payload.changedByName = payload.changedByName ?? meJson.name ?? meJson.displayName ?? meJson.email ?? undefined
              setCurrentUser({ id: payload.changedById, name: payload.changedByName })
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const debugEntry: any = { at: new Date().toISOString(), payload, response: null, error: null }

      try {
        const res = await fetch('/api/admin/role-audit', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const text = await res.text().catch(() => '')
        let body: any = text
        try { body = JSON.parse(text || '') } catch {}
        debugEntry.response = { status: res.status, body }

        // persist attempt into an array in localStorage (most recent first) and prune >30d
        const raw = localStorage.getItem(LOCAL_DEBUG_KEY)
        const arr = raw ? (JSON.parse(raw) || []) : []
        arr.unshift(debugEntry)
        persistDebugArray(arr)

        if (!res.ok) {
          debugEntry.error = `role-audit failed ${res.status}`
          persistDebugArray(arr)
          return false
        }

        return true
      } catch (err: any) {
        debugEntry.error = String(err?.message || err)
        const raw = localStorage.getItem(LOCAL_DEBUG_KEY)
        const arr = raw ? (JSON.parse(raw) || []) : []
        arr.unshift(debugEntry)
        persistDebugArray(arr)
        console.warn('Failed to post audit', err)
        return false
      }
    } catch (e) {
      console.warn('postAudit unexpected error', e)
      return false
    }
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const prevUser = users.find(u => u._id === editingId)
      const prevRole = prevUser?.role
      const prevActive = Boolean(prevUser?.isActive)

      const body = { name: form.name.trim(), role: form.role, isActive: form.isActive }
      const r = await fetch(`/api/admin/users/${editingId}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || 'Error guardando')
      setEditingId(null)
      setRefreshTick(t => t + 1)

      // Audit: role change
      if (prevRole !== undefined && prevRole !== form.role) {
        const auditPayload = {
          targetUserId: editingId,
          targetUserName: form.name.trim() || prevUser?.name || null,
          previousRole: prevRole,
          newRole: form.role,
          note: 'role_changed:manual',
          changedById: currentUser?.id ?? undefined,
          changedByName: currentUser?.name ?? undefined
        }
        await postAudit(auditPayload)
      }

      // Audit: activation/deactivation via edit form
      if (prevActive !== Boolean(form.isActive)) {
        const auditPayload = {
          targetUserId: editingId,
          targetUserName: form.name.trim() || prevUser?.name || null,
          previousRole: prevUser?.role ?? null,
          newRole: form.isActive ? prevUser?.role ?? null : null,
          note: form.isActive ? 'reactivate:manual' : 'deactivate:manual',
          changedById: currentUser?.id ?? undefined,
          changedByName: currentUser?.name ?? undefined
        }
        await postAudit(auditPayload)
      }
    } catch (e: any) { alert(e?.message || 'Error') } finally { setSaving(false) }
  }

  const toggleActive = async (u: UserRow) => {
    if (u.isActive === false) {
      return
    }
    setShowDeactivateId(u._id)
    setShowDeactivateUser(u)
    setDeactReason('inactividad')
  }

  const confirmDeactivate = async () => {
    if (!showDeactivateId || !showDeactivateUser) return
    try {
      const user = showDeactivateUser
      const r = await fetch(`/api/admin/users/${showDeactivateId}`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: deactReason }) })
      if (!r.ok) throw new Error('Error eliminando')
      setUsers(prev => prev.filter(p => p._id !== showDeactivateId))

      const auditPayload = {
        targetUserId: user._id,
        targetUserName: user.name || null,
        previousRole: user.role || null,
        newRole: null,
        note: `delete:${deactReason}`,
        changedById: currentUser?.id ?? undefined,
        changedByName: currentUser?.name ?? undefined
      }
      await postAudit(auditPayload)

      setShowDeactivateId(null)
      setShowDeactivateUser(null)
    } catch (e: any) { alert(e?.message || 'Error') }
  }

  const reactivateUser = async (u: UserRow) => {
    setShowReactivateLoadingId(u._id)
    try {
      const r = await fetch(`/api/admin/users/${u._id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: true })
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || 'Error reactivando')
      setRefreshTick(t => t + 1)

      const auditPayload = {
        targetUserId: u._id,
        targetUserName: u.name || null,
        previousRole: u.role ?? null,
        newRole: u.role ?? null,
        note: `reactivate:manual`,
        changedById: currentUser?.id ?? undefined,
        changedByName: currentUser?.name ?? undefined
      }
      await postAudit(auditPayload)
    } catch (e: any) {
      alert(e?.message || 'Error reactivando')
    } finally {
      setShowReactivateLoadingId(null)
    }
  }

  const goBack = () => {
    const from = (location.state as any)?.from
    if (from) return navigate(from)
    if (window.history.length > 1) return navigate(-1)
    navigate('/admin')
  }

  const roleBadge = (role: string) => {
    const meta = ROLES.find(r => r.value === role)
    return <span className={`px-2 py-1 rounded text-xs font-medium ${meta?.color || 'bg-slate-100 text-slate-700'}`}>{meta?.label || role}</span>
  }

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
  })

  return (
    <div className="pt-16 px-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xl font-semibold">Usuarios</CardTitle>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <input
              placeholder="Buscar nombre, email o rol..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <Button variant="outline" onClick={goBack}>Volver</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
          {loading && <div className="text-slate-600 text-sm">Cargando…</div>}

          <div className="mb-4 p-3 rounded-lg border bg-slate-50 text-slate-700 text-xs leading-relaxed">
            <span className="font-semibold">Acciones:</span> editar nombre/rol/estado, desactivar (soft delete) y reactivar. Cada cambio de rol y cada activación/desactivación se registra en Trazabilidad.
          </div>

          {!loading && filtered.length === 0 && <div className="text-slate-600 text-sm">Sin usuarios por mostrar.</div>}

          {filtered.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100/70">
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 px-3 font-medium">Nombre</th>
                    <th className="py-2 px-3 font-medium">Email</th>
                    <th className="py-2 px-3 font-medium">Rol</th>
                    <th className="py-2 px-3 font-medium">Estado</th>
                    <th className="py-2 px-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const editing = editingId === u._id
                    return (
                      <tr key={u._id} className={`border-b last:border-0 ${editing ? 'bg-yellow-50/40' : ''}`}>
                        <td className="py-2 px-3 align-top min-w-[160px]">
                          {editing ? (
                            <input
                              value={form.name}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                              className="border rounded px-2 py-1 w-full text-sm"
                              maxLength={120}
                            />
                          ) : (
                            <span className="font-medium text-slate-800">{u.name || '—'}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 align-top">{u.email}</td>
                        <td className="py-2 px-3 align-top">
                          {editing ? (
                            <select
                              value={form.role}
                              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          ) : roleBadge(u.role)}
                        </td>
                        <td className="py-2 px-3 align-top">
                          {editing ? (
                            <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none">
                              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                              <span>{form.isActive ? 'Activo' : 'Inactivo'}</span>
                            </label>
                          ) : (
                            <span className={`text-xs font-medium px-2 py-1 rounded ${u.isActive === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{u.isActive === false ? 'Inactivo' : 'Activo'}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 align-top whitespace-nowrap">
                          {!editing && (
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="outline" onClick={() => beginEdit(u)}>Editar</Button>
                              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/users/${u._id}/overrides`)}>Permisos</Button>
                              {u.isActive !== false && <Button size="sm" variant='destructive' className="!bg-red-600 hover:!bg-red-500 !text-white" onClick={() => toggleActive(u)}>Eliminar</Button>}
                              {u.isActive === false && (
                                <Button size="sm" onClick={() => reactivateUser(u)} disabled={showReactivateLoadingId === u._id}>
                                  {showReactivateLoadingId === u._id ? 'Reactivando...' : 'Reactivar'}
                                </Button>
                              )}
                            </div>
                          )}
                          {editing && (
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" onClick={saveEdit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showDeactivateId && showDeactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 border">
            <h2 className="text-lg font-semibold mb-2">Confirmar eliminación</h2>
            <p className="text-sm text-slate-600 mb-4">Selecciona el motivo. El usuario será eliminado definitivamente y quedará solo el rastro en trazabilidad.</p>
            <div className="space-y-2 mb-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="reason" value="inactividad" checked={deactReason === 'inactividad'} onChange={() => setDeactReason('inactividad')} />
                <span>Inactividad prolongada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="reason" value="baja_voluntaria" checked={deactReason === 'baja_voluntaria'} onChange={() => setDeactReason('baja_voluntaria')} />
                <span>Baja voluntaria / solicitada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="reason" value="duplicado" checked={deactReason === 'duplicado'} onChange={() => setDeactReason('duplicado')} />
                <span>Cuenta duplicada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="reason" value="fraude" checked={deactReason === 'fraude'} onChange={() => setDeactReason('fraude')} />
                <span>Sospecha de fraude / abuso</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="reason" value="otro" checked={deactReason === 'otro'} onChange={() => setDeactReason('otro')} />
                <span>Otro / no especificado</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowDeactivateId(null); setShowDeactivateUser(null) }}>Cancelar</Button>
              <Button variant="destructive" className="!bg-red-600 !text-white hover:!bg-red-500" onClick={confirmDeactivate}>Eliminar definitivamente</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}