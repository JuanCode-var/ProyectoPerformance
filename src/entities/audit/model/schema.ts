import { z } from 'zod'

export const StrategySchema = z.enum(['mobile', 'desktop'])

export const RunAuditPayloadSchema = z.object({
  url: z.string().url(),
  strategy: StrategySchema,
  type: z.enum(['performance', 'security']), // Agregado para soportar tipos de auditoría
})

export const AuditResultMetricSchema = z.object({
  id: z.string(),
  title: z.string(),
  score: z.number().min(0).max(1),
  numericValue: z.number().optional(),
  displayValue: z.string().optional(),
})

export const AuditResultSchema = z.object({
  _id: z.string(),
  createdAt: z.string(),
  url: z.string().url(),
  strategy: StrategySchema,
  score: z.number().min(0).max(1),
  metrics: z.array(AuditResultMetricSchema),
  diagramUrl: z.string().url().optional(),
  raw: z.unknown().optional(),
})

export type RunAuditPayload = z.infer<typeof RunAuditPayloadSchema>
export type AuditResult     = z.infer<typeof AuditResultSchema>