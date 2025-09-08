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

const router = Router();

// Ping/Info (evita 500 cuando el front hace GET /api/audit)
router.get("/audit", auditPing);

// Auditoría
router.post("/audit", guardarDatos);
router.get("/audit/history", getAuditHistory); // <- definir antes que :id
router.get("/audit/:id", getAuditById);

// Seguridad
router.get("/security/history", getSecurityHistory);

// Emailing
router.post("/audit/send-diagnostic", sendDiagnostic);
router.post("/audit/send-report", sendReport);

export default router;