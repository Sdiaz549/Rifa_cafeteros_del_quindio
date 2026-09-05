import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { APP_NAME, COMPANY_NAME } from '@shared/constants'

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
    <div className="min-h-full grid place-items-center px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgba(15,61,46,0.18)]">
        <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-8 py-10 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-brand-100/80">Sistema local</p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-2 text-lg text-brand-50">{COMPANY_NAME}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-8 py-8">
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
