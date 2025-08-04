// server/routes/formRoutes.js
import { Router } from 'express';
import {
  guardarDatos,
  getAuditById,
  getAuditHistory
} from '../controllers/formController.js';

const router = Router();

// 1. POST /api/audit
router.post('/', guardarDatos);

// 2. GET  /api/audit/history?url=…
router.get('/history', getAuditHistory);

// 3. GET  /api/audit/:id
router.get('/:id', getAuditById);

export default router;


