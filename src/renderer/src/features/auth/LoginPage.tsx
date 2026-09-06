import { FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  Monitor,
  Users
} from 'lucide-react'
import { useAuth } from './AuthContext'
import logoSorteosCafeteros from '../../assets/logo-sorteos-cafeteros.png'
import loginFinca from '../../assets/login-finca-quindio.jpg'

const REMEMBER_KEY = 'rifa.rememberedUser'

function CoffeeBeanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <ellipse cx="16" cy="16" rx="10" ry="13" fill="#4a2c1a" />
      <path
        d="M16 5c2.2 3.4 2.4 7.2 0 11s-2.4 7.6 0 11"
        fill="none"
        stroke="#ead7a2"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LoginPage() {
  const { session, login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setUsername(saved)
      setRemember(true)
    }
  }, [])

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const err = await login(username.trim(), password)
    if (err) {
      setError(err)
      setSubmitting(false)
      return
    }
    if (remember) localStorage.setItem(REMEMBER_KEY, username.trim())
    else localStorage.removeItem(REMEMBER_KEY)
    setSubmitting(false)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-brand-950">
      <img
        src={loginFinca}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-brand-950/35" />

      <svg
        className="pointer-events-none absolute -top-8 -right-10 h-[280px] w-[420px] text-brand-900/90"
        viewBox="0 0 420 280"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M420 0v168c-48-8-86-46-148-52-72-6-90 38-162 28C48 134 18 78 0 40V0h420z"
        />
      </svg>
      <svg
        className="pointer-events-none absolute -right-6 -bottom-10 h-[220px] w-[380px] text-brand-900/95"
        viewBox="0 0 380 220"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M380 220H0c28-48 78-86 150-78 86 10 98-48 168-52 42-2 48 22 62 46v84z"
        />
      </svg>

      <div className="relative z-10 grid min-h-full lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col items-center justify-center px-8 py-10">
          <img
            src={logoSorteosCafeteros}
            alt="Sorteos Cafeteros"
            className="h-auto w-[min(100%,22rem)] drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
          />
          <p className="login-slogan mt-5 inline-block whitespace-nowrap rounded-full bg-[#07160f]/85 px-8 py-2.5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            Jugamos por grandes sueños
          </p>
        </section>

        <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-[26rem] rounded-[1.6rem] bg-white px-7 py-8 shadow-[0_24px_70px_rgba(20,40,28,0.28)]"
          >
            <CoffeeBeanIcon className="mb-3 h-8 w-8" />
            <h1 className="text-[1.7rem] font-bold tracking-tight text-[#1b5e3b]">Bienvenido</h1>
            <p className="mt-0.5 text-sm text-slate-400">Inicia sesión para continuar</p>

            <label className="mt-6 block">
              <span className="relative block">
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-[#1b5e3b] focus:ring-2 focus:ring-[#1b5e3b]/15"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Usuario"
                  autoComplete="username"
                  required
                />
              </span>
            </label>

            <label className="mt-3 block">
              <span className="relative block">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-11 pl-10 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-[#1b5e3b] focus:ring-2 focus:ring-[#1b5e3b]/15"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-ink"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <div className="mt-4 flex items-center justify-between gap-2 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[#1b5e3b]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-[#1b5e3b]"
                />
                Recordar mi usuario
              </label>
              <button
                type="button"
                className="font-semibold text-[#1b5e3b] hover:underline"
                onClick={() =>
                  toast.message('¿Olvidaste tu contraseña?', {
                    description: 'Pide al administrador que la restablezca en Usuarios.'
                  })
                }
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-accent-red" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1b5e3b] text-sm font-semibold text-white shadow-md shadow-[#1b5e3b]/25 transition hover:bg-[#164c30] disabled:opacity-60"
            >
              <LogIn size={18} />
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </button>

            <div className="mt-6 flex items-center gap-3 text-[11px] tracking-wide text-slate-400 uppercase">
              <span className="h-px flex-1 bg-slate-200" />
              Tu confianza nos impulsa
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] leading-tight font-medium text-[#1b5e3b]">
              <div className="flex flex-col items-center gap-1">
                <Shield size={16} />
                Seguro y confiable
              </div>
              <div className="flex flex-col items-center gap-1">
                <Monitor size={16} />
                Sistema local
              </div>
              <div className="flex flex-col items-center gap-1">
                <Users size={16} />
                Para nuestra familia cafetera
              </div>
            </div>
          </form>

          <div className="mt-8 text-center text-white">
            <p className="font-script text-4xl leading-none">Quindío</p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] uppercase">
              Tierra de grandes historias
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
