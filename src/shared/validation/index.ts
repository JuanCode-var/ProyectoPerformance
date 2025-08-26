import { ZodSchema } from 'zod'

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown, msg = 'Datos inválidos') {
  const r = schema.safeParse(data)
  if (!r.success) throw new Error(`${msg}: ${r.error.message}`)
  return r.data
}
