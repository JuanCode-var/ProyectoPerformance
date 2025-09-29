// server/utils/telemetry.ts
import crypto from 'crypto';
import TelemetryEvent from '../database/telemetryEvent.js';

// High-resolution timer helper
export function hrTimer() { const start = process.hrtime.bigint(); return () => Number(process.hrtime.bigint() - start) / 1e6; }

// Hash URL to short stable id (host+pathname normalized)
export function hashUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const base = parsed.origin + parsed.pathname.replace(/\\+/g,'/');
    return crypto.createHash('sha256').update(base).digest('hex').slice(0,16);
  } catch {
    return crypto.createHash('sha256').update(String(u)).digest('hex').slice(0,16);
  }
}

// Categorize errors for micro diagnostics
export function categorizeError(err: any): string {
  const code = err?.code || '';
  const status = err?.response?.status;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'timeout';
  if (code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'EAI_AGAIN') return 'network';
  if (status && status >= 500) return 'external_api';
  if (status && status >= 400) return 'validation';
  return 'unknown';
}

// Safe telemetry emitter (non-blocking)
export async function emitTelemetry(kind: string, data: Record<string, any>) {
  try {
    await TelemetryEvent.create({ ts: new Date(), kind, ...data });
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('emitTelemetry failed', kind, e?.message); // eslint-disable-line no-console
    }
  }
}
