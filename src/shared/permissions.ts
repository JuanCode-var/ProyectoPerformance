// Frontend permissions shared types & helpers (mirrors backend catalog)
export interface PermissionDef {
  key: string;
  group: string;
  label: string;
  description?: string;
  critical?: boolean;
  defaultRoles?: string[];
}

export interface RolePermissionsResponse { role: string; permissions: string[]; persisted?: boolean; version?: number }

export interface CatalogResponse { items: PermissionDef[] }

export type RoleKey = 'admin' | 'tecnico' | 'operario' | 'cliente';

export function diffPermissions(before: string[], after: string[]) {
  const b = new Set(before);
  const a = new Set(after);
  const added: string[] = []; const removed: string[] = [];
  for (const k of a) if(!b.has(k)) added.push(k);
  for (const k of b) if(!a.has(k)) removed.push(k);
  return { added, removed };
}
