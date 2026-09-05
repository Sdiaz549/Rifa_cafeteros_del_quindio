import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, WalletCards, LayoutDashboard } from 'lucide-react'
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-8 py-10 text-white shadow-lg">
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, #7CFF6B33, transparent 42%), radial-gradient(circle at 85% 0%, #ffffff22, transparent 36%)'
          }}
        />
        <div className="relative">
          <p className="text-sm uppercase tracking-[0.22em] text-brand-100/80">{COMPANY_NAME}</p>
          <h1 className="font-display mt-2 text-5xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-3 max-w-xl text-brand-50/95">
            Bienvenido/a, {session?.fullName}. Gestione boletas, ventas y abonos desde este puesto
            local.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/nueva-venta"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            >
              <ShoppingCart size={16} />
              Nueva venta
            </Link>
            <Link
              to="/abonos"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15"
            >
              <WalletCards size={16} />
              Registrar abono
            </Link>
            {can('dashboard:view') && (
              <Link
                to="/admin/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15"
              >
                <LayoutDashboard size={16} />
                Dashboard admin
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total boletas', value: stats?.total, tone: 'bg-white' },
          { label: 'Sin vender', value: stats?.disponible, tone: 'bg-white' },
          { label: 'En abonos', value: stats?.enAbonos, tone: 'bg-[#FFF8E1]' },
          { label: 'Canceladas', value: stats?.cancelada, tone: 'bg-brand-50' }
        ].map((card) => (
          <div key={card.label} className={`stat-card ${card.tone}`}>
            <p className="text-sm text-ink-muted">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-brand-900">
              {card.value == null ? '…' : card.value.toLocaleString('es-CO')}
            </p>
          </div>
        ))}
      </section>

      <div className="app-card p-5 text-sm text-ink-muted">
        {can('dashboard:view')
          ? 'Los totales financieros detallados están en Administración → Dashboard.'
          : `Vista operativa. Los montos globales están reservados al administrador. Ejemplo de formato: ${formatCop(50000)}.`}
      </div>
    </div>
  )
}
