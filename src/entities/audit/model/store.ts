import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createAuditHistorySlice } from '../../../shared/model/slices/audit-history'
import { createUiSlice } from '../../../shared/model/slices/ui'
import type { AuditHistorySlice } from '../../../shared/model/slices/audit-history'
import type { UiSlice } from '../../../shared/model/slices/ui'
import type { StateCreator } from 'zustand'

export type AppState = AuditHistorySlice & UiSlice

const createRootSlice: StateCreator<
  AppState,
  [['zustand/devtools', unknown], ['zustand/persist', unknown]]
> = (set, get, api) => ({
  ...createAuditHistorySlice(set, get, api),
  ...createUiSlice(set, get, api),
})

export const useAppStore = create<AppState>()(
  devtools(
    persist(createRootSlice, { name: 'pcp-app' }), // localStorage key
    { name: 'pcp-store' }
  )
)
