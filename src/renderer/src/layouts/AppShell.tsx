import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Ticket,
  TicketX,
  ShoppingCart,
  WalletCards,
  Users,
  UserRound,
  FileBarChart2,
  Settings2,
  LogOut,
  Mic,
  Search,
  Shield
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { APP_NAME, COMPANY_NAME } from '@shared/constants'
import { FormEvent, useState } from 'react'
import { cn } from '../lib/cn'

const mainNav = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/boletas', label: 'Boletas', icon: Ticket },
  { to: '/boletas-sin-vender', label: 'Boletas sin vender', icon: TicketX },
  { to: '/nueva-venta', label: 'Nueva Venta', icon: ShoppingCart },
  { to: '/abonos', label: 'Abonos', icon: WalletCards },
  { to: '/compradores', label: 'Compradores', icon: Users },
  { to: '/vendedores', label: 'Vendedores', icon: UserRound },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2 }
]

const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/ingresos', label: 'Ingresos' },
  { to: '/admin/egresos', label: 'Egresos' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/metodos-pago', label: 'Métodos de pago' },
  { to: '/admin/auditoria', label: 'Auditoría' },
  { to: '/admin/configuracion', label: 'Configuración' },
  { to: '/admin/backups', label: 'Backups' }
]

export function AppShell() {
  const { session, logout, can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const isAdmin = session?.role === 'ADMIN'

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate(`/boletas?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white">
        <div className="border-b border-white/10 px-5 py-6">
          <p className="font-display text-3xl font-bold tracking-tight">{APP_NAME}</p>
          <p className="mt-1 text-sm text-brand-100/90">{COMPANY_NAME}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-white/15 text-white' : 'text-brand-100/85 hover:bg-white/10'
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <div className="pt-4">
              <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-brand-100/60">
                <Shield size={14} />
                Administración
              </div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-xl px-3 py-2 text-sm transition',
                      isActive ? 'bg-white/15 text-white' : 'text-brand-100/85 hover:bg-white/10'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{session?.fullName}</p>
          <p className="text-xs text-brand-100/70">{session?.role}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-white/80 px-6 py-3 backdrop-blur">
          <form onSubmit={onSearch} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar boleta, comprador, cédula, teléfono o vendedor…"
                className="w-full rounded-xl border border-line bg-surface py-2.5 pr-3 pl-10 outline-none ring-brand-700/20 focus:ring-2"
              />
            </div>
            <button
              type="button"
              title="Comandos de voz (próximamente)"
              className="rounded-xl border border-line bg-white p-2.5 text-brand-800 hover:bg-brand-50"
            >
              <Mic size={18} />
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Buscar
            </button>
          </form>
          {can('dashboard:view') && (
            <Settings2 className="hidden text-ink-muted lg:block" size={18} aria-hidden />
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
