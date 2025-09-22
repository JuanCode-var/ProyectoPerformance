// server/routes/formRoutes.js
import { Router } from "express";
import {
  auditPing,          // GET /api/audit (ping/info)
  guardarDatos,       // POST /api/audit
  getAuditById,       // GET  /api/audit/:id
  getAuditHistory,    // GET  /api/audit/history
  sendReport,         // POST /api/audit/send-report
  sendDiagnostic,     // POST /api/audit/send-diagnostic
  getSecurityHistory, // GET /api/security/history
} from "../controllers/FormController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Ping/Info (evita 500 cuando el front hace GET /api/audit)
router.get("/audit", auditPing);

// Auditoría
router.post(
  "/audit",
  requireAuth as any,
  // Ahora también permite 'cliente'
  requireRole('admin','operario','tecnico','otro_tecnico','cliente') as any,
  guardarDatos
);

// Lecturas protegidas
// Histórico de auditorías: solo roles no-cliente
router.get(
  "/audit/history",
  requireAuth as any,
  requireRole('admin','operario','tecnico','otro_tecnico') as any,
  getAuditHistory
);
// Detalle: permitido para todos los autenticados; el controlador debe validar propiedad para clientes
router.get("/audit/:id", requireAuth as any, getAuditById);

// Seguridad (histórico) solo no-cliente
router.get(
  "/security/history",
  requireAuth as any,
  requireRole('admin','operario','tecnico','otro_tecnico') as any,
  getSecurityHistory
);

// Emailing (requiere sesión)
router.post("/audit/send-diagnostic", requireAuth as any, sendDiagnostic);
router.post("/audit/send-report", requireAuth as any, sendReport);

export default router;