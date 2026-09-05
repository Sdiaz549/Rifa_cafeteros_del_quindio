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
    <div className="grid min-h-full place-items-center px-4 py-8">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-white/95 shadow-[0_28px_70px_rgba(15,61,46,0.16)]">
        <div className="flex flex-col items-center px-6 pb-1 pt-8 sm:px-10 sm:pt-10">
          <img
            src={logoSorteosCafeteros}
            alt="Sorteos Cafeteros"
            className="h-auto w-[min(100%,26rem)] object-contain"
          />
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-8 pb-8 pt-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Usuario</label>
            <input
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none ring-brand-700/30 focus:ring-2"
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
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none ring-brand-700/30 focus:ring-2"
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
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-800 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
          <p className="text-center text-xs text-ink-muted">
            Desarrollo: usuario <strong>admin</strong> (ver README para contraseña de seed)
          </p>
        </form>
      </div>
    </div>
  )
}
