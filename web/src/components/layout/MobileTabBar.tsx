import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

// Solo mobile (oculto en md+): barra de iconos fija abajo, con el nombre
// corto debajo de cada icono. Evita el sidebar de 240px, que en una
// pantalla de ~390px dejaba el contenido aplastado en una columna angosta.
export function MobileTabBar() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          title={item.label}
          className={({ isActive }) =>
            `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium leading-tight ${
              isActive ? 'text-primary' : 'text-text-muted'
            }`
          }
        >
          <item.icon size={20} />
          <span className="truncate px-0.5">{item.shortLabel}</span>
        </NavLink>
      ))}
    </nav>
  )
}
