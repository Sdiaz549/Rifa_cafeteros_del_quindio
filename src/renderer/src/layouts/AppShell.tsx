import { FormEvent, useEffect, useMemo, useState } from 'react'
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
  LogOut,
  Mic,
  Search,
  Shield,
  HandCoins,
  Bell,
  CalendarDays
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { APP_NAME, COMPANY_NAME } from '@shared/constants'
import { cn } from '../lib/cn'
import type { Permission } from '@shared/permissions'

const mainNav: Array<{
  to: string
  label: string
  icon: typeof Ticket
  end?: boolean
  permission: Permission | null
}> = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true, permission: null },
  { to: '/boletas', label: 'Boletas', icon: Ticket, permission: null },
  { to: '/boletas-sin-vender', label: 'Boletas sin vender', icon: TicketX, permission: 'unsold:view' },
  { to: '/nueva-venta', label: 'Nueva Venta', icon: ShoppingCart, permission: 'tickets:sell' },
  { to: '/abonos', label: 'Abonos', icon: WalletCards, permission: 'payments:create' },
  { to: '/liquidaciones', label: 'Liquidaciones', icon: HandCoins, permission: 'settlements:manage' },
  { to: '/compradores', label: 'Compradores', icon: Users, permission: 'buyers:manage' },
  { to: '/vendedores', label: 'Vendedores', icon: UserRound, permission: 'sellers:manage' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2, permission: 'reports:operational' }
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

function CloverMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M24 8c-3.2 0-5.8 2.4-6.3 5.5C14.8 12.8 12 14.8 12 18.2c0 3.2 2.4 5.8 5.5 6.3C16.8 27.2 18.8 30 22.2 30c.6 0 1.2-.1 1.8-.2V40h2V29.8c.6.1 1.2.2 1.8.2 3.4 0 5.4-2.8 4.7-5.5 3.1-.5 5.5-3.1 5.5-6.3 0-3.4-2.8-5.4-5.7-4.7C29.8 10.4 27.2 8 24 8z"
      />
    </svg>
  )
}

export function AppShell() {
  const { session, logout, can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const isAdmin = session?.role === 'ADMIN'

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const dateLabel = useMemo(
    () =>
      now.toLocaleString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    [now]
  )

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate(`/boletas?q=${encodeURIComponent(q)}`)
  }

  const initials = (session?.fullName ?? 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex h-full min-h-0 bg-surface">
      <aside className="sidebar-leaf-pattern relative flex w-[17.5rem] shrink-0 flex-col bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <CloverMark className="h-7 w-7 text-[#7CFF6B]" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold leading-none tracking-tight">{APP_NAME}</p>
              <p className="mt-1 text-sm font-medium text-brand-100">{COMPANY_NAME}</p>
              <p className="mt-1 text-[11px] italic text-white/55">Jugamos por grandes sueños</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNav
            .filter((item) => !item.permission || can(item.permission))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-white/15 text-white shadow-inner'
                      : 'text-brand-100/85 hover:bg-white/10'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white" />
                    )}
                    <item.icon size={18} className={isActive ? 'text-[#9AFF7A]' : 'opacity-90'} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}

          {isAdmin && (
            <div className="pt-4">
              <div className="mb-2 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100/55">
                <Shield size={13} />
                Administración
              </div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'relative block rounded-xl px-3 py-2 text-sm transition',
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

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="rounded-2xl bg-white p-3 text-ink shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-brand-800">
              <CalendarDays size={16} />
              <p className="text-[11px] font-semibold uppercase tracking-wide">Sorteo</p>
            </div>
            <p className="mt-1 font-display text-lg font-bold text-brand-900">Próximamente</p>
            <p className="text-xs text-ink-muted">Configure la fecha en Administración</p>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium hover:bg-white/15"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>

          <p className="px-1 text-center font-display text-[11px] italic text-white/45">
            Más que una rifa, una gran familia
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-line bg-brand-900 px-5 py-3 text-white shadow-md shadow-brand-950/20">
          <form onSubmit={onSearch} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative w-full max-w-2xl">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
                size={18}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar número, comprador, cédula o vendedor…"
                className="w-full rounded-full border-0 bg-white py-2.5 pr-4 pl-10 text-sm text-ink outline-none ring-0 placeholder:text-ink-muted"
              />
            </div>
            <button
              type="button"
              title="Comandos de voz (próximamente)"
              className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/15"
            >
              <Mic size={18} />
            </button>
          </form>

          <div className="hidden items-center gap-2 text-xs text-white/80 xl:flex">
            <CalendarDays size={15} />
            <span>{dateLabel}</span>
          </div>

          <button
            type="button"
            className="relative rounded-full bg-white/10 p-2.5 hover:bg-white/15"
            title="Notificaciones"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-red ring-2 ring-brand-900" />
          </button>

          <div className="flex items-center gap-2.5 rounded-full bg-white/10 py-1.5 pr-3 pl-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#7CFF6B] text-xs font-bold text-brand-950">
              {initials || 'U'}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-tight">{session?.fullName}</p>
              <p className="text-[11px] text-white/65">
                {session?.role === 'ADMIN' ? 'Administrador' : 'Usuario'}
              </p>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-5 md:p-6">
          <Outlet />
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-5 py-2 text-[11px] text-ink-muted">
          <p>Sistema de Gestión de Rifas v1.0</p>
          <p className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            Base de datos: Local
          </p>
          <p className="hidden sm:block">
            {COMPANY_NAME} · Disciplina · Pasión · Grandes Sueños
          </p>
        </footer>
      </div>
    </div>
  )
}
