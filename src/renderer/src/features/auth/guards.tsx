import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Permission } from '@shared/permissions'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="grid h-full place-items-center text-ink-muted">Cargando sesión…</div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}

export function RequirePermission({
  permission,
  children
}: {
  permission: Permission
  children: ReactNode
}) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <h2 className="font-display text-2xl text-brand-900">Acceso restringido</h2>
        <p className="mt-2 text-ink-muted">No tiene permisos para ver este módulo.</p>
      </div>
    )
  }
  return children
}
