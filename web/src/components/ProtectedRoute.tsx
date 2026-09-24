import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useIsAuthenticated } from '@/hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const isAuthenticated = useIsAuthenticated()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
