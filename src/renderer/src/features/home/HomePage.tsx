import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatCop } from '@shared/money'
import { APP_NAME, COMPANY_NAME } from '@shared/constants'

export function HomePage() {
  const { session, can } = useAuth()
  const [stats, setStats] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await window.api.tickets.stats()
      if (res.ok) setStats(res.data)
    })()
  }, [])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-8 py-10 text-white shadow-lg">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #76ff0333, transparent 40%), radial-gradient(circle at 80% 0%, #ffffff22, transparent 35%)'
        }} />
        <div className="relative">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-100/80">{COMPANY_NAME}</p>
          <h1 className="font-display mt-2 text-5xl font-bold">{APP_NAME}</h1>
          <p className="mt-3 max-w-xl text-brand-50/95">
            Bienvenido/a, {session?.fullName}. Gestione boletas, ventas y abonos desde este puesto
            local.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/nueva-venta"
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            >
              Nueva venta
            </Link>
            <Link
              to="/abonos"
              className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15"
            >
              Registrar abono
            </Link>
            {can('dashboard:view') && (
              <Link
                to="/admin/dashboard"
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15"
              >
                Dashboard admin
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total boletas', value: stats?.total },
          { label: 'Sin vender', value: stats?.disponible },
          { label: 'En abonos', value: stats?.enAbonos },
          { label: 'Canceladas', value: stats?.cancelada }
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <p className="text-sm text-ink-muted">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-brand-900">
              {card.value == null ? '…' : card.value}
            </p>
          </div>
        ))}
      </section>

      {can('dashboard:view') && (
        <p className="text-sm text-ink-muted">
          Los totales financieros detallados están en Administración → Dashboard.
        </p>
      )}

      {!can('dashboard:view') && (
        <p className="text-sm text-ink-muted">
          Vista operativa. Los montos globales están reservados al administrador.
          {stats ? ` Recaudo operativo no mostrado. Ejemplo formato: ${formatCop(50000)}.` : null}
        </p>
      )}
    </div>
  )
}
