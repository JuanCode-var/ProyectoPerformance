import type { StateCreator } from 'zustand'

export type UiSlice = {
  theme: 'light' | 'dark'
  busy: boolean
  setTheme: (t: 'light' | 'dark') => void
  setBusy: (b: boolean) => void
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  theme: 'light',
  busy: false,
  setTheme: (t) => set({ theme: t }),
  setBusy: (b) => set({ busy: b }),
})
