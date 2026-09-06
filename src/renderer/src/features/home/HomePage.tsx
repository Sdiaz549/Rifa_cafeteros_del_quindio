import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, WalletCards, LayoutDashboard, Ticket } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { formatCop } from '@shared/money'
import { COMPANY_NAME } from '@shared/constants'
import type { PublicSettings } from '@shared/types'
import { formatDateCo } from '@shared/dates'

export function HomePage() {
  const { session, can } = useAuth()
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [settings, setSettings] = useState<PublicSettings | null>(null)

  useEffect(() => {
    void (async () => {
      const [statsRes, settingsRes] = await Promise.all([
        window.api.tickets.stats(),
        window.api.settings.getPublic()
      ])
      if (statsRes.ok) setStats(statsRes.data)
      if (settingsRes.ok) setSettings(settingsRes.data)
    })()
  }, [])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-8 py-10 text-white shadow-[0_24px_50px_rgba(11,42,30,0.28)]">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, rgba(201,162,74,.35), transparent 42%), radial-gradient(circle at 85% 0%, rgba(255,255,255,.12), transparent 36%)'
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.26em] text-gold-soft uppercase">
            {settings?.companyName ?? COMPANY_NAME}
          </p>
          <h1 className="font-display mt-2 text-5xl font-semibold tracking-tight">
            {settings?.raffleName ?? 'RIFA'}
          </h1>
          <p className="mt-3 max-w-xl text-white/85">
            Bienvenido/a, {session?.fullName}. Gestione boletas, ventas y abonos desde este puesto
            local, con el sello de la casa cafetera.
          </p>
          {settings?.drawDate && (
            <p className="mt-2 text-sm text-gold-soft">Sorteo: {formatDateCo(settings.drawDate)}</p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/nueva-venta" className="btn-primary bg-white text-brand-900 shadow-none hover:bg-brand-50">
              <ShoppingCart size={16} />
              Nueva venta
            </Link>
            <Link to="/abonos" className="btn-ghost border-white/25 bg-white/10 text-white hover:bg-white/15">
              <WalletCards size={16} />
              Registrar abono
            </Link>
            <Link to="/boletas" className="btn-ghost border-white/25 bg-white/10 text-white hover:bg-white/15">
              <Ticket size={16} />
              Ver boletas
            </Link>
            {can('dashboard:view') && (
              <Link
                to="/admin/dashboard"
                className="btn-ghost border-white/25 bg-white/10 text-white hover:bg-white/15"
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
          { label: 'Total boletas', value: stats?.total },
          { label: 'Sin vender', value: stats?.disponible },
          { label: 'En abonos', value: stats?.enAbonos },
          { label: 'Canceladas', value: stats?.cancelada }
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{card.label}</p>
            <p className="font-display mt-2 text-3xl font-semibold text-brand-900">
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
