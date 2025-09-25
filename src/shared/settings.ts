// Shared Settings model and helpers
export type Role = 'cliente' | 'tecnico' | 'operario' | 'admin'

export type UiFlags = {
  // Clientes
  showSecurityHistoryToClients: boolean
  enableActionPlanDetailsForClients: boolean
  showRisksAndImprovementsToClients: boolean
  allowRunDiagnosticsByClients: boolean
  // Técnicos
  showSecurityHistoryToTechnicians: boolean
  enableActionPlanDetailsForTechnicians: boolean
  allowRunDiagnosticsByTechnicians: boolean
  // Operarios
  showSecurityHistoryToOperators: boolean
  enableActionPlanDetailsForOperators: boolean
  allowRunDiagnosticsByOperators: boolean
}

export type SettingsModel = {
  ui: UiFlags
}

export const SETTINGS_STORAGE_KEY = 'app.settings'

export const DEFAULT_SETTINGS: SettingsModel = {
  ui: {
    // Clientes (por defecto limitados)
    showSecurityHistoryToClients: false,
    enableActionPlanDetailsForClients: false,
    showRisksAndImprovementsToClients: false,
    allowRunDiagnosticsByClients: false,
    // Técnicos (por defecto habilitados)
    showSecurityHistoryToTechnicians: true,
    enableActionPlanDetailsForTechnicians: true,
    allowRunDiagnosticsByTechnicians: true,
    // Operarios (alineado a técnicos por defecto)
    showSecurityHistoryToOperators: true,
    enableActionPlanDetailsForOperators: true,
    allowRunDiagnosticsByOperators: true,
  },
}

export function loadSettings(): SettingsModel {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)

    const merged: SettingsModel = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      ui: { ...DEFAULT_SETTINGS.ui, ...(parsed?.ui || {}) },
    }
    return merged
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: SettingsModel) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s))
}

export function getUiFlag<K extends keyof UiFlags>(key: K): UiFlags[K] {
  const s = loadSettings()
  return s.ui[key]
}
