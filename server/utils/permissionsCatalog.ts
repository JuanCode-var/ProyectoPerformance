// server/utils/permissionsCatalog.ts
// Catálogo central de permisos. Mantener claves en kebab/camel sencillas.
// Cada permiso puede tener: key, group, label, description, defaultRoles, critical
export interface PermissionDef {
  key: string;
  group: string; // categoría funcional
  label: string;
  description?: string;
  defaultRoles: string[]; // roles que lo reciben por defecto (admin implícito)
  critical?: boolean; // protección extra
}

export const PERMISSIONS_CATALOG: PermissionDef[] = [
  // Seguridad
  { key: 'security.view_basic', group: 'Seguridad', label: 'Ver resumen seguridad', defaultRoles: ['tecnico','operario','cliente'] },
  { key: 'security.view_history', group: 'Seguridad', label: 'Ver histórico seguridad', defaultRoles: ['tecnico','operario'] },
  { key: 'security.view_headers', group: 'Seguridad', label: 'Ver detalle de encabezados', defaultRoles: ['tecnico','operario'] },
  { key: 'security.view_cookies', group: 'Seguridad', label: 'Ver cookies completas', defaultRoles: ['tecnico'] },
  { key: 'security.view_findings', group: 'Seguridad', label: 'Ver hallazgos/riesgos', defaultRoles: ['tecnico','operario'] },
  { key: 'security.view_action_plan', group: 'Seguridad', label: 'Ver plan de acción', defaultRoles: ['tecnico','operario'] },
  { key: 'security.run_diagnostic', group: 'Seguridad', label: 'Ejecutar diagnósticos seguridad', defaultRoles: ['tecnico','operario','cliente'] },
  { key: 'security.export_pdf', group: 'Seguridad', label: 'Exportar PDF seguridad', defaultRoles: ['tecnico','operario'] },
  { key: 'security.email_report', group: 'Seguridad', label: 'Enviar reporte email', defaultRoles: ['tecnico','operario'] },

  // Performance
  { key: 'performance.view_basic', group: 'Performance', label: 'Ver resumen performance', defaultRoles: ['tecnico','operario','cliente'] },
  { key: 'performance.view_history', group: 'Performance', label: 'Ver histórico performance', defaultRoles: ['tecnico','operario'] },
  { key: 'performance.view_breakdowns', group: 'Performance', label: 'Ver desgloses performance', defaultRoles: ['tecnico','operario'] },
  { key: 'performance.run_diagnostic', group: 'Performance', label: 'Ejecutar diagnósticos performance', defaultRoles: ['tecnico','operario','cliente'] },
  { key: 'performance.view_action_plan', group: 'Performance', label: 'Ver plan de acción performance', defaultRoles: ['tecnico','operario'] },
  { key: 'performance.change_strategy', group: 'Performance', label: 'Cambiar entre móvil/escritorio', defaultRoles: ['tecnico','operario'] },

  // Auditoría / Logs
  { key: 'audit.view', group: 'Auditoria', label: 'Ver auditoría', defaultRoles: ['tecnico'] },
  { key: 'audit.view_role_changes', group: 'Auditoria', label: 'Ver cambios de rol', defaultRoles: ['tecnico'] },
  { key: 'audit.export', group: 'Auditoria', label: 'Exportar auditoría', defaultRoles: [] },

  // Plan / Gestión
  { key: 'plan.view', group: 'Plan', label: 'Ver plan de acción detallado', defaultRoles: ['tecnico','operario'] },
  { key: 'plan.edit', group: 'Plan', label: 'Editar plan de acción', defaultRoles: ['tecnico'] },
  { key: 'plan.assign_owner', group: 'Plan', label: 'Asignar responsables', defaultRoles: ['tecnico'] },

  // Usuarios / Roles
  { key: 'users.view', group: 'Usuarios', label: 'Ver usuarios', defaultRoles: ['tecnico'] },
  { key: 'users.manage', group: 'Usuarios', label: 'Gestionar usuarios', defaultRoles: [] , critical: true},
  { key: 'roles.view', group: 'Roles', label: 'Ver roles', defaultRoles: ['tecnico'] },
  { key: 'roles.manage', group: 'Roles', label: 'Gestionar roles y permisos', defaultRoles: [] , critical: true},

  // Configuración
  { key: 'config.view', group: 'Configuracion', label: 'Ver configuraciones', defaultRoles: ['tecnico'] },
  { key: 'config.manage', group: 'Configuracion', label: 'Editar configuraciones', defaultRoles: [] , critical: true},

  // Reportes
  { key: 'reports.generate', group: 'Reportes', label: 'Generar reportes', defaultRoles: ['tecnico','operario'] },
  { key: 'reports.share', group: 'Reportes', label: 'Compartir reportes', defaultRoles: ['tecnico'] },

  // Sistema / Avanzado
  { key: 'system.force_recalc', group: 'Sistema', label: 'Forzar recalculo', defaultRoles: [] },
  { key: 'system.impersonate', group: 'Sistema', label: 'Impersonar usuario', defaultRoles: [] },
  { key: 'advanced.download_json', group: 'Avanzado', label: 'Descargar JSON bruto', defaultRoles: ['tecnico'] },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS_CATALOG.map(p => p.key));

export function defaultsForRole(role: string): string[] {
  if (role === 'admin') return Array.from(PERMISSION_KEYS); // admin todo
  return PERMISSIONS_CATALOG.filter(p => p.defaultRoles.includes(role)).map(p => p.key);
}
