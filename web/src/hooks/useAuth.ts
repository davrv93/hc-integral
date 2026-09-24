import { useSyncExternalStore } from 'react'
import { authStore } from '@/lib/auth'

export function useAuthUser() {
  return useSyncExternalStore(authStore.subscribe, () => authStore.getUser())
}

export function useIsAuthenticated() {
  return useSyncExternalStore(authStore.subscribe, () => authStore.isAuthenticated())
}
