import type { StateCreator } from 'zustand'
import type { AuditResult } from '../../../entities/audit/model/schema'

export type AuditHistorySlice = {
  lastResults: AuditResult[]
  selectedReportIds: string[]
  addResult: (r: AuditResult) => void
  selectForCompare: (ids: string[]) => void
  clearHistory: () => void
}

export const createAuditHistorySlice: StateCreator<AuditHistorySlice> = (set, get) => ({
  lastResults: [],
  selectedReportIds: [],
  addResult: (r) =>
    set((s) => ({ lastResults: [r, ...s.lastResults].slice(0, 200) })),
  selectForCompare: (ids) => set(() => ({ selectedReportIds: ids })),
  clearHistory: () => set(() => ({ lastResults: [], selectedReportIds: [] })),
})
