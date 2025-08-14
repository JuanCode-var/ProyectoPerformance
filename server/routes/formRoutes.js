import { Router } from 'express';
import {
  auditPing,          // 👈 nuevo
  guardarDatos,
  getAuditById,
  getAuditHistory,
  sendReport,
  sendDiagnostic
} from '../controllers/formController.js';

const router = Router();

// Ping/Info (evita 500 cuando el front hace GET /api/audit)
router.get('/audit', auditPing);

router.post('/audit', guardarDatos);
router.get('/audit/history', getAuditHistory);
router.get('/audit/:id', getAuditById);
router.post('/audit/send-diagnostic', sendDiagnostic);
router.post('/audit/send-report', sendReport);

export default router;
