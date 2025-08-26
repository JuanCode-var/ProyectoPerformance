import axios from 'axios'

// Cliente base: todas las llamadas al backend pasan por aquí
export const api = axios.create({
  baseURL: '/api', // tu proxy ya lo envía al 4000
  timeout: 30000,
})

// Helper para abortar (axios soporta AbortSignal)
export const withAbort = (signal?: AbortSignal) => ({ signal })
