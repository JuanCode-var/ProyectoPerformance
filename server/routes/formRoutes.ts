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
import { requireAuth, requireRole, requirePermissions } from "../middleware/auth.js";

const router = Router();

// Ping/Info (evita 500 cuando el front hace GET /api/audit)
router.get("/audit", auditPing);

// Middleware alternativo para clientes
const allowClientes = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  
  console.log('🔍 [ALTERNATIVE] User role:', req.user.role);
  
  // Lista explícita de roles permitidos
  const allowedRoles = ['admin', 'operario', 'tecnico', 'cliente'];
  
  if (allowedRoles.includes(req.user.role)) {
    console.log('✅ [ALTERNATIVE] Role accepted:', req.user.role);
    return next();
  }
  
  console.log('❌ [ALTERNATIVE] Role rejected:', req.user.role);
  return res.status(403).json({ error: 'Sin permisos' });
};

// Auditoría
router.post(
  "/audit",
  requireAuth as any,
  allowClientes,
  guardarDatos
);

// Auditoría con middleware alternativo
router.post(
  "/audit-alt",
  requireAuth as any,
  allowClientes,
  guardarDatos
);

// Lecturas protegidas
// Histórico de auditorías: permitir también a clientes (el controlador filtra por userId)
router.get(
  "/audit/history",
  requireAuth as any,
  requireRole('admin','operario','tecnico','cliente') as any,
  getAuditHistory
);
// Detalle: permitido para todos los autenticados; el controlador debe validar propiedad para clientes
router.get("/audit/:id", requireAuth as any, getAuditById);

// Seguridad (histórico) ahora controlado por permiso granular
router.get(
  "/security/history",
  requireAuth as any,
  (req: any, res: any, next: any) => { if (process.env.DEBUG_PERMS === 'true') console.log('[route] /security/history user=%s role=%s', req.user?.email, req.user?.role); next(); },
  requirePermissions('security.view_history') as any,
  (req: any, res: any, next: any) => { if (process.env.DEBUG_PERMS === 'true') console.log('[route] /security/history passed perms role=%s', req.user?.role); next(); },
  getSecurityHistory
);

// Debug: ver permisos efectivos del usuario autenticado en runtime
router.get('/security/debug/my-perms', requireAuth as any, async (req: any, res: any) => {
  try {
    const { defaultsForRole, PERMISSION_KEYS } = require('../utils/permissionsCatalog.js');
    let effective: string[] = [];
    try {
      const RolePermissions = require('../database/rolePermissions.js').default;
      const doc = await RolePermissions.findOne({ role: req.user.role }).lean();
      effective = doc?.permissions || defaultsForRole(req.user.role);
    } catch (e:any) {
      effective = defaultsForRole(req.user.role);
    }
    return res.json({ role: req.user.role, effective, all: Array.from(PERMISSION_KEYS) });
  } catch (e:any) {
    return res.status(500).json({ error: 'debug_failed', detail: e?.message });
  }
});

// Emailing (requiere sesión)
router.post("/audit/send-diagnostic", requireAuth as any, sendDiagnostic);
router.post("/audit/send-report", requireAuth as any, sendReport);

// Ruta de prueba SIN middleware para diagnosticar
router.post("/audit-test", guardarDatos);

export default router;