import mongoose from "mongoose";

// Esquema para los datos de seguridad
const SecuritySchema = new mongoose.Schema(
  {
    url: { type: String, required: true, index: true },
    score: { type: Number, required: true },
    grade: { type: String, required: true },
    findings: { type: Array, default: [] },
    checks: { type: Array, default: [] },
    meta: { type: Object, default: {} },
    fecha: { type: Date, default: Date.now },
  },
  { collection: "security" } // Nueva colección "security"
);

// Exportar el modelo
const Security = mongoose.model("Security", SecuritySchema);
export default Security;
