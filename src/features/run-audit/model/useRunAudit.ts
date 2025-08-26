import { useCallback, useState } from 'react'
import { useAppStore } from '../../../entities/audit/model/store'
import type { RunAuditPayload, AuditResult } from '../../../entities/audit/model/schema' // <-- aquí
import { runAudit } from '../api'

export function useRunAudit() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AuditResult | null>(null)
  const addResult = useAppStore((s) => s.addResult)

  const submit = useCallback(async (payload: RunAuditPayload) => {
    setLoading(true)
    setError(null)
    try {
      const res = await runAudit(payload)
      setResult(res)
      addResult(res)
      return res
    } catch (e: any) {
      setError(e?.message ?? 'Error ejecutando auditoría')
      throw e
    } finally {
      setLoading(false)
    }
  }, [addResult])

  return { loading, error, result, submit }
}
