// server/routes/admin.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listUsers, getLogs, getTelemetry, trackTelemetry, clearLogs, clearTelemetry, getTelemetrySummary, getLogSummary, updateUser, deleteUser, getRoleAudit } from '../controllers/admin.controller.js';

const router = Router();

// Require authentication for all routes under this router
router.use(requireAuth);

// Admin-only reads
router.get('/admin/users', requireRole('admin'), listUsers);
router.get('/admin/logs', requireRole('admin'), getLogs);
router.get('/admin/telemetry', requireRole('admin'), getTelemetry);
router.get('/admin/telemetry/summary', requireRole('admin'), getTelemetrySummary);
router.get('/admin/logs/summary', requireRole('admin'), getLogSummary);
router.get('/admin/role-audit', requireRole('admin'), getRoleAudit);

// Admin-only maintenance
router.post('/admin/logs/clear', requireRole('admin'), clearLogs);
router.post('/admin/telemetry/clear', requireRole('admin'), clearTelemetry);

// Any authenticated user can track telemetry
router.post('/admin/telemetry', trackTelemetry);

// Update and delete user routes
router.patch('/admin/users/:id', requireRole('admin'), updateUser);
router.delete('/admin/users/:id', requireRole('admin'), deleteUser);

export default router;
