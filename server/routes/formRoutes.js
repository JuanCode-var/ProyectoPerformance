import { Router } from 'express';
import {
  guardarDatos,
  getAuditById,
  getAuditHistory,
  sendReport
} from '../controllers/formController.js';

const router = Router();

// Rutas (¡ojo con el orden!)
router.post('/audit', guardarDatos);
router.get('/audit/history', getAuditHistory); // antes de /audit/:id
router.get('/audit/:id', getAuditById);
router.post('/audit/send-report', sendReport); // comparativa histórico (la que ya usabas)

export default router;
