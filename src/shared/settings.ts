// Shared Settings model and helpers
export type Role = 'cliente' | 'tecnico' | 'admin'

export type UiFlags = {
  showSecurityHistoryToClients: boolean
  enableActionPlanDetailsForClients: boolean
  // New: technician-specific controls
  showSecurityHistoryToTechnicians: boolean
  enableActionPlanDetailsForTechnicians: boolean
}

export type SettingsModel = {
  defaultRole: Role
  psiApiKey?: string
  securityTimeoutMs: number
  ui: UiFlags
}

export const SETTINGS_STORAGE_KEY = 'app.settings'

export const DEFAULT_SETTINGS: SettingsModel = {
  defaultRole: 'cliente',
  psiApiKey: '',
  securityTimeoutMs: 45000,
  ui: {
    showSecurityHistoryToClients: false,
    enableActionPlanDetailsForClients: false,
    // Defaults for technicians: enabled by default
    showSecurityHistoryToTechnicians: true,
    enableActionPlanDetailsForTechnicians: true,
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
      securityTimeoutMs: Number.isFinite(Number(parsed?.securityTimeoutMs))
        ? Number(parsed.securityTimeoutMs)
        : DEFAULT_SETTINGS.securityTimeoutMs,
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
