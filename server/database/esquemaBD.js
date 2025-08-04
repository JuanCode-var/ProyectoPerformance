// server/database/esquemaBD.js
import mongoose from 'mongoose';

const MetricSchema = new mongoose.Schema({
  fcp:  Number,
  lcp:  Number,
  cls:  Number,
  tbt:  Number,
  si:   Number,
  ttfb: Number,
}, { _id: false });

const AuditSchema = new mongoose.Schema({
  url:        { type: String, required: true, index: true },
  type:       { type: String, enum: ['pagespeed', 'unlighthouse'], required: true },
  strategy:   { type: String, enum: ['mobile', 'desktop'], default: 'mobile' },

  // Campos para resultados y metadatos
  performance: Number,
  metrics:     MetricSchema,
  raw:         Object,       // histórico completo / debugging
  audit:       Object,       // resultado combinado de tus microservicios
  fecha:       { type: Date, default: Date.now },
  // // createdAt es equivalente a fecha si prefieres
  // createdAt: { type: Date, default: Date.now },
}, {
  collection: 'audits'
});

export default mongoose.model('Audit', AuditSchema);

