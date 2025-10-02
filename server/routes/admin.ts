// server/routes/admin.ts
import { Router } from 'express';
import { requireAuth, requireRole, requirePermissions } from '../middleware/auth.js';
import { listUsers, getLogs, getTelemetry, trackTelemetry, clearLogs, clearTelemetry, getTelemetrySummary, getLogSummary, updateUser, deleteUser, getRoleAudit, getPermissionsCatalog, getRolePermissions, upsertRolePermissions, resetRolePermissions, listAllRolePermissions, listRawRolePermissions, getUserEffectivePermissionsAdmin } from '../controllers/admin.controller.js';
import { PERMISSIONS_CATALOG } from '../utils/permissionsCatalog.js';
import { grantUserHistory, revokeUserHistory, updateUserOverrides } from '../controllers/admin.controller.js';

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
router.get('/admin/permissions/catalog', requireRole('admin'), getPermissionsCatalog);
router.get('/admin/permissions/roles', requireRole('admin'), listAllRolePermissions);
router.get('/admin/permissions/roles/:role', requireRole('admin'), getRolePermissions);

// Admin-only maintenance
router.post('/admin/logs/clear', requireRole('admin'), clearLogs);
router.post('/admin/telemetry/clear', requireRole('admin'), clearTelemetry);

// Any authenticated user can track telemetry
router.post('/admin/telemetry', trackTelemetry);

// Update and delete user routes
router.patch('/admin/users/:id', requireRole('admin'), updateUser);
router.delete('/admin/users/:id', requireRole('admin'), deleteUser);
router.patch('/admin/users/:id/grant-history', requireRole('admin'), grantUserHistory);
router.patch('/admin/users/:id/revoke-history', requireRole('admin'), revokeUserHistory);
router.patch('/admin/users/:id/overrides', requireRole('admin'), updateUserOverrides);

// --- Permisos & Roles (fase inicial: sólo catálogo y defaults) ---
router.get('/admin/permissions/catalog', requireRole('admin'), (_req, res) => {
  return res.json({ items: PERMISSIONS_CATALOG });
});

// Placeholder endpoints for future persistent role permission storage
router.get('/admin/roles/permissions/defaults', requireRole('admin'), (req, res) => {
  const role = String(req.query.role||'').trim();
  if(!role) return res.status(400).json({ error: 'role requerido' });
  try {
    const { defaultsForRole } = require('../utils/permissionsCatalog.js');
    return res.json({ role, permissions: defaultsForRole(role) });
  } catch(e:any){
    return res.status(500).json({ error: 'No se pudieron obtener permisos', detail: e?.message });
  }
});

// Ejemplo de ruta protegida por permisos granulares (demostración)
router.get('/admin/example/secure-headers', requireAuth, requirePermissions('security.view_headers'), (req, res) => {
  return res.json({ ok: true, demo: 'Acceso permitido a security.view_headers' });
});

// Actualizar permisos (requiere admin; luego podrá requerir roles.manage)
router.put('/admin/permissions/roles/:role', requireRole('admin'), upsertRolePermissions);
// Reset a defaults
router.post('/admin/permissions/roles/:role/reset', requireRole('admin'), resetRolePermissions);

// Ruta de depuración: permisos efectivos (mezcla doc persistido o defaults)
router.get('/admin/permissions/effective/:role', requireRole('admin'), async (req, res) => {
  const role = String(req.params.role||'');
  try {
    const RolePermissions = require('../database/rolePermissions.js').default;
    const { defaultsForRole } = require('../utils/permissionsCatalog.js');
    const doc = await RolePermissions.findOne({ role }).lean();
    return res.json({ role, persisted: !!doc, permissions: doc?.permissions || defaultsForRole(role) });
  } catch(e:any){ return res.status(500).json({ error: 'debug_failed', detail: e?.message }); }
});

// Listar documentos crudos de role_permissions
router.get('/admin/permissions/raw', requireRole('admin'), (req,res,next)=>{ console.log('[perms][raw] list request by', req.user?.email); next(); }, listRawRolePermissions as any);

// Nueva ruta: permisos efectivos de usuario (debug admin)
router.get('/admin/users/:id/effective-permissions', requireRole('admin'), getUserEffectivePermissionsAdmin);

export default router;
