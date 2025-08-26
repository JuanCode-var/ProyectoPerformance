import { api, withAbort } from '../../../shared/api/base'
import {
  RunAuditPayloadSchema,
  AuditResultSchema,
  type RunAuditPayload,
  type AuditResult,
} from '../../../entities/audit/model/schema'   // <-- ANTES entities/...
import { parseOrThrow } from '../../../shared/validation'

export async function runAudit(payload: RunAuditPayload, signal?: AbortSignal) {
  const body = parseOrThrow(RunAuditPayloadSchema, payload, 'Payload de auditoría inválido')
  const { data } = await api.post('/audit', body, withAbort(signal))
  return parseOrThrow(AuditResultSchema, data, 'Respuesta de auditoría inválida') as AuditResult
}
