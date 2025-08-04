// server/routes/formRoutes.js  (ESM)
import { Router } from 'express';
import { guardarDatos, getAuditById } from '../controllers/formController.js';
import { getAudits } from '../controllers/auditHistory.controller.js';

const router = Router();

router.post('/audit', guardarDatos);
router.get ('/audit/:id', getAuditById);
router.get ('/audits',     getAudits);

export default router;
