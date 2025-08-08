// server/database/esquemaBD.js
import mongoose from 'mongoose';

// Subdocumento de métricas
const MetricSchema = new mongoose.Schema({
  fcp:   Number,
  lcp:   Number,
  // cls:   Number,
  tbt:   Number,
  si:    Number,
  ttfb:  Number,
}, { _id: false });

// Esquema principal de Auditoría
const AuditSchema = new mongoose.Schema({
  url:        { type: String, required: true, index: true },
  type:       { type: String, enum: ['pagespeed', 'unlighthouse'], required: true },
  strategy:   { type: String, enum: ['mobile', 'desktop'], default: 'mobile' },
  name:       { type: String },   // Nombre del usuario
  email:      { type: String },   // Correo del usuario
  performance: Number,            // Score de performance (si aplica)
  metrics:     MetricSchema,      // Métricas resumidas
  raw:         Object,            // (opcional) datos crudos completos, para debugging
  audit:       Object,            // Respuesta completa de microservicios
  fecha:       { type: Date, default: Date.now }, // Fecha del registro
}, {
  collection: 'audits'
});

export default mongoose.model('Audit', AuditSchema);

