import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthUser } from '@/hooks/useAuth'
import { logout } from '@/lib/auth'
import { NAV_ITEMS } from './navItems'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

// Solo escritorio (md+): en mobile la navegación vive en MobileTabBar, una
// barra de iconos fija abajo, para que el contenido nunca compita con el
// sidebar por ancho en pantallas chicas.
export function Sidebar() {
  const user = useAuthUser()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="hidden h-full w-[240px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white font-serif font-semibold">
          HC
        </span>
        <span className="font-serif text-lg font-semibold text-text">HC Integral</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  `flex min-h-control items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150 ease-out ${
                    isActive ? 'bg-primary-soft text-primary' : 'text-text-soft hover:bg-bg'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-control p-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            {user ? initials(user.nombre) : '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{user?.nombre ?? 'Usuario'}</p>
            <p className="truncate text-xs text-text-muted">{user?.rol ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-danger-soft-bg hover:text-danger-soft-fg"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
