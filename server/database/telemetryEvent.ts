// server/database/telemetryEvent.ts
import mongoose from 'mongoose';

export interface TelemetryEventDoc extends mongoose.Document {
  ts: Date;
  kind: string;
  userId?: string | null;
  role?: string | null;
  urlHash?: string | null;
  domain?: string | null;
  urlSample?: string | null;
  micro?: string | null;
  micros?: string[] | null;
  tipos?: string[] | null; // NUEVO: tipos (tipos solicitados en diagnostic.start)
  durationMs?: number | null;
  success?: boolean | null;
  status?: number | null;
  retries?: number | null;
  pdfSizeKb?: number | null;
  hasPdf?: boolean | null;
  emailType?: string | null;
  meta?: unknown;
  diagId?: string | null;
  pagespeedMs?: number | null;
  securityMs?: number | null;
  errorCategory?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TelemetryEventSchema = new mongoose.Schema<TelemetryEventDoc>({
  ts: { type: Date, default: () => new Date(), index: true },
  kind: { type: String, required: true, index: true },
  userId: { type: String, default: null, index: true },
  role: { type: String, default: null, index: true },
  urlHash: { type: String, default: null, index: true },
  domain: { type: String, default: null, index: true },
  urlSample: { type: String, default: null },
  micro: { type: String, default: null },
  micros: { type: [String], default: null },
  tipos: { type: [String], default: null }, // NUEVO: tipos (tipos solicitados en diagnostic.start)
  durationMs: { type: Number, default: null },
  success: { type: Boolean, default: null },
  status: { type: Number, default: null },
  retries: { type: Number, default: null },
  pdfSizeKb: { type: Number, default: null },
  hasPdf: { type: Boolean, default: null },
  emailType: { type: String, default: null },
  meta: { type: mongoose.Schema.Types.Mixed },
  diagId: { type: String, default: null, index: true },
  pagespeedMs: { type: Number, default: null },
  securityMs: { type: Number, default: null },
  errorCategory: { type: String, default: null, index: true },
}, { timestamps: true, collection: 'telemetry_events' });

// TTL configurable
const days = Number(process.env.TELEMETRY_TTL_DAYS || 45);
if (Number.isFinite(days) && days > 0) {
  TelemetryEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: days * 24 * 60 * 60 });
}

TelemetryEventSchema.index({ kind: 1, ts: -1 });
TelemetryEventSchema.index({ role: 1, kind: 1, ts: -1 });
TelemetryEventSchema.index({ userId: 1, kind: 1, ts: -1 });
TelemetryEventSchema.index({ diagId: 1, kind: 1 });
TelemetryEventSchema.index({ kind: 1, errorCategory: 1 });
// Índices adicionales para summaries (optimización)
TelemetryEventSchema.index({ emailType: 1, kind: 1 });
TelemetryEventSchema.index({ urlHash: 1, kind: 1 });
TelemetryEventSchema.index({ micro: 1, kind: 1 });
TelemetryEventSchema.index({ createdAt: -1, kind: 1 });
TelemetryEventSchema.index({ kind: 1, 'tipos': 1 }); // NUEVO: índice para tipos

const TelemetryEvent = mongoose.model<TelemetryEventDoc>('TelemetryEvent', TelemetryEventSchema);
export default TelemetryEvent;
