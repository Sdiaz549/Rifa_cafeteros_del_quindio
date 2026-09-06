import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  CalendarDays,
  Landmark,
  Receipt,
  UserCog,
  CreditCard,
  ScrollText,
  Settings,
  HardDrive,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../features/auth/AuthContext'
import { APP_NAME, COMPANY_NAME } from '@shared/constants'
import { parseVoiceCommand } from '@shared/voice/parseCommand'
import { formatDateCo } from '@shared/dates'
import { cn } from '../lib/cn'
import type { Permission } from '@shared/permissions'
import type { PaymentMethodSummary, PublicSettings } from '@shared/types'

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

const adminNav: Array<{ to: string; label: string; icon: typeof Shield }> = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/ingresos', label: 'Ingresos', icon: Landmark },
  { to: '/admin/egresos', label: 'Egresos', icon: Receipt },
  { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
  { to: '/admin/metodos-pago', label: 'Métodos de pago', icon: CreditCard },
  { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
  { to: '/admin/backups', label: 'Backups', icon: HardDrive }
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

type VoicePending = {
  ticketNumber: number
  amount: number
  paymentMethodId: string
  paymentMethodName: string
}

export function AppShell() {
  const { session, logout, can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [listening, setListening] = useState(false)
  const [pendingVoice, setPendingVoice] = useState<VoicePending | null>(null)
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const isAdmin = session?.role === 'ADMIN'

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    void window.api.settings.getPublic().then((res) => {
      if (res.ok) setSettings(res.data)
    })
    if (can('payments:create')) {
      void window.api.paymentMethods.listActive().then((res) => {
        if (res.ok) setMethods(res.data)
      })
    }
  }, [can])

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

  const runVoice = useCallback(
    async (raw: string) => {
      const cmd = parseVoiceCommand(raw)
      if (cmd.action === 'BUSCAR_BOLETA' && cmd.ticketNumber) {
        navigate(`/boletas/${cmd.ticketNumber}`)
        toast.success(`Boleta ${String(cmd.ticketNumber).padStart(4, '0')}`)
        return
      }
      if (cmd.action === 'MOSTRAR_SIN_VENDER') {
        navigate('/boletas-sin-vender')
        return
      }
      if (cmd.action === 'MOSTRAR_EN_ABONOS') {
        navigate('/boletas?q=&status=EN_ABONOS')
        navigate('/boletas')
        return
      }
      if (cmd.action === 'MOSTRAR_PERDIDAS') {
        navigate('/boletas')
        return
      }
      if (cmd.action === 'MOSTRAR_LIQUIDADAS') {
        navigate('/liquidaciones')
        return
      }
      if (cmd.action === 'BUSCAR_VENDEDOR') {
        navigate(`/vendedores`)
        return
      }
      if (cmd.action === 'REGISTRAR_ABONO') {
        if (!cmd.ticketNumber || !cmd.amount) {
          toast.error('Diga: abono de 20000 a la boleta 12 por Nequi')
          return
        }
        const match = cmd.paymentMethodName
          ? methods.find((m) => m.name.toLowerCase().includes(cmd.paymentMethodName!.toLowerCase()))
          : methods[0]
        if (!match) {
          toast.error('No hay métodos de pago activos')
          return
        }
        setPendingVoice({
          ticketNumber: cmd.ticketNumber,
          amount: cmd.amount,
          paymentMethodId: match.id,
          paymentMethodName: match.name
        })
        return
      }
      toast.message(`No entendí: “${raw}”`)
    },
    [methods, navigate]
  )

  function toggleVoice() {
    const Ctor = (
      window as unknown as {
        webkitSpeechRecognition?: new () => {
          lang: string
          interimResults: boolean
          maxAlternatives: number
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
          onerror: (() => void) | null
          onend: (() => void) | null
          start: () => void
          stop: () => void
        }
        SpeechRecognition?: new () => {
          lang: string
          interimResults: boolean
          maxAlternatives: number
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
          onerror: (() => void) | null
          onend: (() => void) | null
          start: () => void
          stop: () => void
        }
      }
    ).webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition?: new () => never }).SpeechRecognition

    if (!Ctor) {
      toast.error('El reconocimiento de voz no está disponible en este equipo.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new Ctor()
    rec.lang = 'es-CO'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? ''
      void runVoice(text)
    }
    rec.onerror = () => {
      setListening(false)
      toast.error('No se pudo escuchar. Revise el micrófono.')
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  async function confirmVoicePayment() {
    if (!pendingVoice) return
    const res = await window.api.payments.create({
      ticketNumber: pendingVoice.ticketNumber,
      amount: pendingVoice.amount,
      paymentMethodId: pendingVoice.paymentMethodId,
      origin: 'VOZ'
    })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Abono por voz registrado')
    setPendingVoice(null)
    navigate(`/boletas/${pendingVoice.ticketNumber}`)
  }

  const initials = (session?.fullName ?? 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex h-full min-h-0 bg-surface">
      <aside className="sidebar-leaf-pattern relative flex w-[17.75rem] shrink-0 flex-col bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-gold/40">
              <CloverMark className="h-7 w-7 text-gold-soft" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[1.7rem] font-semibold leading-none tracking-tight">
                {APP_NAME}
              </p>
              <p className="mt-1 text-sm font-medium text-gold-soft">
                {settings?.companyName ?? COMPANY_NAME}
              </p>
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
                      ? 'bg-white/12 text-white shadow-inner'
                      : 'text-brand-100/85 hover:bg-white/10'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold" />
                    )}
                    <item.icon size={18} className={isActive ? 'text-gold-soft' : 'opacity-90'} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}

          {isAdmin && (
            <div className="pt-4">
              <div className="mb-2 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-soft/80">
                <Shield size={13} />
                Administración
              </div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                      isActive ? 'bg-white/12 text-white' : 'text-brand-100/85 hover:bg-white/10'
                    )
                  }
                >
                  <item.icon size={16} className="opacity-80" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="rounded-2xl bg-[#fffaf2] p-3 text-ink shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-brand-800">
              <CalendarDays size={16} />
              <p className="text-[11px] font-semibold uppercase tracking-wide">Sorteo</p>
            </div>
            <p className="mt-1 font-display text-lg font-semibold text-brand-900">
              {settings?.drawDate ? formatDateCo(settings.drawDate) : 'Por definir'}
            </p>
            <p className="text-xs text-ink-muted">
              {settings?.raffleName ?? 'Configure la fecha en Administración'}
            </p>
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
        <header className="flex items-center gap-4 border-b border-brand-950/30 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 px-5 py-3 text-white shadow-md shadow-brand-950/20">
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
                className="w-full rounded-full border-0 bg-[#fffaf2] py-2.5 pr-4 pl-10 text-sm text-ink outline-none ring-0 placeholder:text-ink-muted"
              />
            </div>
            <button
              type="button"
              title="Comandos de voz"
              onClick={toggleVoice}
              className={cn(
                'rounded-full p-2.5 text-white transition',
                listening ? 'bg-accent-red animate-pulse' : 'bg-white/10 hover:bg-white/15'
              )}
            >
              <Mic size={18} />
            </button>
          </form>

          <div className="hidden items-center gap-2 text-xs text-white/80 xl:flex">
            <CalendarDays size={15} />
            <span>{dateLabel}</span>
          </div>

          <div className="flex items-center gap-2.5 rounded-full bg-white/10 py-1.5 pr-3 pl-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gold text-xs font-bold text-brand-950">
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

        <main className="min-h-0 flex-1 overflow-auto p-5 md:p-7">
          <Outlet />
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#fffaf2] px-5 py-2 text-[11px] text-ink-muted">
          <p>Sistema de Gestión de Rifas v1.0</p>
          <p className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            Base de datos: Local
          </p>
          <p className="hidden sm:block">
            {settings?.companyName ?? COMPANY_NAME} · Disciplina · Pasión · Grandes Sueños
          </p>
        </footer>
      </div>

      {pendingVoice && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="app-card w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="page-kicker">Confirmación de voz</p>
                <h2 className="font-display mt-1 text-2xl text-brand-900">¿Registrar abono?</h2>
              </div>
              <button type="button" className="btn-ghost px-2 py-2" onClick={() => setPendingVoice(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              Boleta <strong>{String(pendingVoice.ticketNumber).padStart(4, '0')}</strong> ·{' '}
              {pendingVoice.amount.toLocaleString('es-CO')} COP · {pendingVoice.paymentMethodName}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPendingVoice(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={() => void confirmVoicePayment()}>
                Confirmar abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
