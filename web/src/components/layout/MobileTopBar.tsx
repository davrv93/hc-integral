import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { logout } from '@/lib/auth'

// Solo mobile: barra superior chica con logo + logout. La navegación en si
// vive en MobileTabBar (abajo); el sidebar completo queda solo en desktop.
export function MobileTopBar() {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center gap-2.5 border-b border-border bg-surface px-4 py-3 md:hidden">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-primary text-sm font-serif font-semibold text-white">
        HC
      </span>
      <span className="flex-1 truncate font-serif text-base font-semibold text-text">HC Integral</span>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Cerrar sesión"
        className="inline-flex h-11 w-11 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-danger-soft-bg hover:text-danger-soft-fg"
      >
        <LogOut size={17} />
      </button>
    </header>
  )
}
