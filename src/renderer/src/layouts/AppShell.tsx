import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Ticket,
  TicketX,
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
import { COMPANY_NAME } from '@shared/constants'
import { parseVoiceCommand } from '@shared/voice/parseCommand'
import { formatDateCo } from '@shared/dates'
import { cn } from '../lib/cn'
import { isSpeechRecognitionAvailable, startSpeechRecognition } from '../lib/speechRecognition'
import type { Permission } from '@shared/permissions'
import type { PaymentMethodSummary, PublicSettings } from '@shared/types'
import logoSorteosCafeteros from '../assets/logo-sorteos-cafeteros.png'
import loginFinca from '../assets/login-finca-quindio.jpg'

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
  { to: '/abonos', label: 'Abonos', icon: WalletCards, permission: 'payments:create' },
  { to: '/compradores', label: 'Compradores', icon: Users, permission: 'buyers:manage' },
  { to: '/vendedores', label: 'Vendedores', icon: UserRound, permission: 'sellers:manage' },
  { to: '/liquidaciones', label: 'Boletas liquidadas', icon: HandCoins, permission: 'settlements:manage' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2, permission: 'reports:operational' }
]

const adminNav: Array<{ to: string; label: string; icon: typeof Shield }> = [
  { to: '/admin/ingresos', label: 'Ingresos', icon: Landmark },
  { to: '/admin/egresos', label: 'Egresos', icon: Receipt },
  { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
  { to: '/admin/metodos-pago', label: 'Métodos de pago', icon: CreditCard },
  { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
  { to: '/admin/backups', label: 'Copias de seguridad', icon: HardDrive },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings }
]

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
  const [voiceHint, setVoiceHint] = useState('')
  const [pendingVoice, setPendingVoice] = useState<VoicePending | null>(null)
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const isAdmin = session?.role === 'ADMIN'

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    return () => recognitionRef.current?.stop()
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
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
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
      if (cmd.action === 'BUSCAR_BOLETA' && cmd.ticketNumber != null) {
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
        if (cmd.ticketNumber == null || !cmd.amount) {
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

  async function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setListening(false)
      setVoiceHint('')
      return
    }
    if (!isSpeechRecognitionAvailable()) {
      toast.error('El reconocimiento de voz no está disponible en este equipo.')
      return
    }
    try {
      const handle = await startSpeechRecognition({
        onListening: () => {
          setListening(true)
          setVoiceHint('Escuchando… hable ahora')
          toast.message('Micrófono activo. Hable ahora.')
        },
        onTranscript: (text, isFinal) => {
          setVoiceHint(text)
          if (isFinal) void runVoice(text)
        },
        onError: (message) => {
          setListening(false)
          setVoiceHint('')
          toast.error(message)
        },
        onEnd: () => {
          recognitionRef.current = null
          setListening(false)
          setVoiceHint('')
        }
      })
      recognitionRef.current = handle
    } catch (error) {
      setListening(false)
      setVoiceHint('')
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        toast.error(
          'Windows bloqueó el micrófono. En Configuración → Privacidad → Micrófono, permita el acceso a las aplicaciones de escritorio.'
        )
        return
      }
      if (name === 'NotFoundError') {
        toast.error('No se detectó micrófono. Conéctelo e intente de nuevo.')
        return
      }
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el micrófono.')
    }
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
    <div className="flex h-full min-h-0 bg-dash-bg">
      <aside className="sidebar-cafetero relative flex w-[17.75rem] shrink-0 flex-col text-white">
        <div className="border-b border-white/10 px-5 py-4">
          <img
            src={logoSorteosCafeteros}
            alt="Sorteos Cafeteros"
            className="mx-auto h-auto w-[11.75rem] drop-shadow-[0_8px_16px_rgba(0,0,0,0.28)]"
          />
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
                      ? 'bg-[#1f6b48] text-white'
                      : 'text-white/85 hover:bg-white/10'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#8fd14f]" />
                    )}
                    <item.icon size={18} className={isActive ? 'text-[#c8f59b]' : 'text-white/90'} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}

          {isAdmin && (
            <div className="mt-3 border-t border-white/15 pt-3">
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                      isActive ? 'bg-[#1f6b48] text-white' : 'text-white/85 hover:bg-white/10'
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

        <div className="space-y-2 p-3">
          <p className="px-1 text-center text-[11px] text-white/70">
            Sorteo {settings?.drawDate ? formatDateCo(settings.drawDate) : 'por definir'}
          </p>
          <div className="relative overflow-hidden rounded-2xl">
            <img src={loginFinca} alt="" className="h-[7.5rem] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <p className="font-script absolute inset-x-2 bottom-2 text-center text-[1.35rem] leading-tight text-white">
              Más que un sorteo, una gran familia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-dash-line bg-white px-5 py-3">
          <form onSubmit={onSearch} className="flex min-w-0 flex-1 items-center">
            <div className="relative w-full max-w-3xl">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-dash-muted"
                size={18}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar número, comprador, vendedor, cédula..."
                className="w-full rounded-full border border-dash-line bg-white py-2.5 pr-12 pl-11 text-sm text-forest shadow-sm outline-none placeholder:text-dash-muted focus:border-forest"
              />
              <button
                type="button"
                title={"Haz clic y habla: buscar boleta 8587"}
                onClick={() => void toggleVoice()}
                className={cn(
                  'absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-2 transition',
                  listening ? 'bg-accent-red text-white animate-pulse' : 'text-dash-muted hover:bg-dash-bg'
                )}
              >
                <Mic size={18} />
              </button>
            </div>
          </form>

          <div className="hidden items-center gap-2 text-xs text-dash-muted xl:flex">
            <CalendarDays size={15} />
            <span>{dateLabel}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-forest text-xs font-bold text-white">
              {initials || 'U'}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-tight text-forest">{session?.fullName}</p>
              <p className="text-[11px] text-dash-muted">
                {session?.role === 'ADMIN' ? 'Administrador' : 'Usuario'}
              </p>
            </div>
          </div>
        </header>

        {listening && (
          <div className="border-b border-amber-300 bg-[#fff9c4] px-5 py-2 text-sm font-medium text-forest">
            {voiceHint || 'Escuchando… hable ahora'}
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-auto p-5 md:p-7">
          <Outlet />
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-dash-line bg-white px-5 py-2 text-[11px] text-dash-muted">
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
