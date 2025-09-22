// server/database/esquemaBD.ts
import mongoose from "mongoose";

// Subdocumento de métricas (igual al original)
const MetricSchema = new mongoose.Schema(
  {
    fcp: Number,
    lcp: Number,
    cls: Number, // Cumulative Layout Shift
    tbt: Number,
    si: Number,
    ttfb: Number,
  },
  { _id: false }
);

// Tipos mínimos del documento
export interface Metric {
  fcp?: number | null;
  lcp?: number | null;
  cls?: number | null;
  tbt?: number | null;
  si?: number | null;
  ttfb?: number | null;
}

export interface AuditDoc extends mongoose.Document {
  url: string;
  type: "pagespeed" | "unlighthouse" | "security" | (string & {});
  strategy: "mobile" | "desktop" | (string & {});
  name?: string;
  email?: string;
  userId?: mongoose.Types.ObjectId | null;
  performance?: number;
  metrics?: Metric | null;
  raw?: unknown;
  audit?: unknown;
  tipos?: string[];
  security?: unknown;
  fecha: Date;
}

// Esquema principal de Auditoría (misma estructura/campos)
const AuditSchema = new mongoose.Schema<AuditDoc>(
  {
    url: { type: String, required: true, index: true },
    type: { type: String, enum: ["pagespeed", "unlighthouse", "security"], required: true },
    strategy: { type: String, enum: ["mobile", "desktop"], default: "mobile" },
    name: { type: String },
    email: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    performance: Number,
    metrics: MetricSchema,
    raw: Object,
    audit: Object,
    tipos: { type: [String], default: [] },
    security: Object,
    fecha: { type: Date, default: Date.now },
  },
  { collection: "audits" }
);

// Export default (igual que en JS)
const Audit = mongoose.model<AuditDoc>("Audit", AuditSchema);
export default Audit;