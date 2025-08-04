import { Router } from 'express';
import {
  guardarDatos,
  getAuditById,
  getAuditHistory,
  sendReport
} from '../controllers/formController.js';

const router = Router();

router.post('/',        guardarDatos);
router.get('/history',  getAuditHistory);
router.get('/:id',      getAuditById);

// ← nueva ruta
router.post('/send-report', sendReport);

export default router;

