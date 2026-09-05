import { useEffect, useState } from 'react'
import { formatCop } from '@shared/money'
import { RequirePermission } from '../auth/guards'

function DashboardContent() {
  const [data, setData] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await window.api.dashboard.get()
      if (!res.ok) setError(res.error)
      else setData(res.data)
    })()
  }, [])

  if (error) return <p className="text-accent-red">{error}</p>
  if (!data) return <p className="text-ink-muted">Cargando dashboard…</p>

  const cards = [
    { label: 'Ingresos del día', value: formatCop(data.ingresosDia ?? 0) },
    { label: 'Ingresos del mes', value: formatCop(data.ingresosMes ?? 0) },
    { label: 'Egresos', value: formatCop(data.egresosTotal ?? 0) },
    { label: 'Balance', value: formatCop(data.balance ?? 0) },
    { label: 'Total recaudado', value: formatCop(data.recaudado ?? 0) },
    { label: 'Por cobrar', value: formatCop(data.porCobrar ?? 0) },
    { label: 'Boletas total', value: String(data.total ?? 0) },
    { label: 'Vendidas', value: String(data.vendidas ?? 0) },
    { label: 'Sin vender', value: String(data.disponible ?? 0) },
    { label: 'En abonos', value: String(data.enAbonos ?? 0) },
    { label: 'Canceladas', value: String(data.cancelada ?? 0) },
    { label: 'Perdidas', value: String(data.perdida ?? 0) },
    { label: 'Liquidadas', value: String(data.liquidadas ?? 0) },
    { label: 'Pend. liquidación', value: String(data.pendienteLiquidacion ?? 0) }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Dashboard administrativo</h1>
        <p className="text-sm text-ink-muted">Resumen financiero y de boletas (solo ADMIN)</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className="mt-2 text-xl font-semibold text-brand-900">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        Filtros por periodo y gráficos (Recharts) se agregan en la Fase 13 completa.
      </p>
    </div>
  )
}

export function DashboardPage() {
  return (
    <RequirePermission permission="dashboard:view">
      <DashboardContent />
    </RequirePermission>
  )
}
