import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import logoSorteosCafeteros from '../../assets/logo-sorteos-cafeteros.jpg'

export function LoginPage() {
  const { session, login, loading } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const err = await login(username.trim(), password)
    if (err) setError(err)
    setSubmitting(false)
  }

  return (
    <div className="login-atmosphere grid min-h-full lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(201,162,74,.25), transparent 32%), radial-gradient(circle at 80% 80%, rgba(255,255,255,.08), transparent 28%)'
        }} />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.28em] text-gold-soft uppercase">
            Cafeteros del Quindío
          </p>
          <h1 className="font-display mt-4 max-w-md text-5xl leading-tight font-semibold">
            La rifa de una gran familia
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Sistema local, seguro y sin internet. Boletas, ventas, abonos y liquidaciones en un
            solo puesto de trabajo.
          </p>
        </div>
        <div className="relative">
          <div className="gold-rule mb-6 max-w-sm" />
          <p className="font-display text-lg italic text-gold-soft">
            Disciplina · Pasión · Grandes sueños
          </p>
        </div>
      </section>

      <section className="grid place-items-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-[#fffaf2] shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
          <div className="bg-brand-950 px-8 pt-8 pb-4">
            <img
              src={logoSorteosCafeteros}
              alt="Sorteos Cafeteros"
              className="mx-auto h-auto w-[min(100%,18rem)] object-contain"
            />
          </div>
          <form onSubmit={onSubmit} className="space-y-4 px-8 pt-6 pb-8">
            <div className="text-center">
              <p className="page-kicker">Bienvenido</p>
              <h2 className="font-display mt-1 text-2xl text-brand-900">Iniciar sesión</h2>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Usuario</label>
              <input
                className="field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Contraseña</label>
              <input
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-accent-red" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
              {submitting ? 'Ingresando…' : 'Entrar al sistema'}
            </button>
            <p className="text-center text-xs text-ink-muted">
              Desarrollo: usuario <strong>admin</strong> · ver README para la clave de seed
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
