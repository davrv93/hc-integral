import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authStore, refreshTokens } from './auth'

// Empty string = relative to the page's own origin, routed through the
// Vite dev proxy (vite.config.ts) to the real api-service. This lets the
// app be reached through any hostname (localhost, LAN IP, a tunnel) without
// baking one origin into the built bundle. Set VITE_API_URL only for a
// deployment where the api-service is NOT reachable via this same origin.
export const API_URL = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = authStore.getAccessToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<boolean> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true

      if (!refreshPromise) {
        refreshPromise = refreshTokens().finally(() => {
          refreshPromise = null
        })
      }
      const refreshed = await refreshPromise

      if (refreshed) {
        const token = authStore.getAccessToken()
        if (token) original.headers.set('Authorization', `Bearer ${token}`)
        return api(original)
      }

      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export interface ApiError {
  code: string
  message: string
}

export function extractApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: ApiError } | undefined
    if (body?.error) return body.error
    return { code: 'network_error', message: error.message }
  }
  return { code: 'unknown', message: 'Ocurrio un error inesperado.' }
}
