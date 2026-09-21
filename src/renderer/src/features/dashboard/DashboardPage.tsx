import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { formatCop } from '@shared/money'
import { RequirePermission } from '../auth/guards'
import { PageHeader } from '../../components/PageHeader'
import { LayoutDashboard } from 'lucide-react'
import type { DashboardSnapshot } from '@shared/types'
import { cn } from '../../lib/cn'

const PERIODS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'anio', label: 'Año' },
  { id: 'rango', label: 'Rango' }
] as const

const PIE_COLORS = ['#fffdf8', '#ffe082', '#8cff4a', '#e53935']

function DashboardContent() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('mes')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await window.api.dashboard.get({
        period,
        from: period === 'rango' ? from || undefined : undefined,
        to: period === 'rango' ? to || undefined : undefined
      })
      if (!res.ok) setError(res.error)
      else {
        setError(null)
        setData(res.data)
      }
    })()
  }, [period, from, to])

  if (error) return <p className="text-accent-red">{error}</p>
  if (!data) return <p className="text-ink-muted">Cargando dashboard…</p>

  const moneyCards = [
    { label: 'Ingresos del periodo', value: formatCop(data.ingresosPeriodo) },
    { label: 'Ingresos del día', value: formatCop(data.ingresosDia) },
    { label: 'Ingresos del mes', value: formatCop(data.ingresosMes) },
    { label: 'Egresos del periodo', value: formatCop(data.egresosPeriodo) },
    { label: 'Balance', value: formatCop(data.balance) },
    { label: 'Por cobrar', value: formatCop(data.porCobrar) }
  ]
  const ticketCards = [
    { label: 'Total boletas', value: data.total },
    { label: 'Vendidas', value: data.vendidas },
    { label: 'Sin vender', value: data.disponible },
    { label: 'En abonos', value: data.enAbonos },
    { label: 'Canceladas', value: data.cancelada },
    { label: 'Perdidas', value: data.perdida },
    { label: 'Liquidadas', value: data.liquidadas },
    { label: 'Pend. liquidación', value: data.pendienteLiquidacion }
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard administrativo"
        description="Resumen financiero, estados de boletas y recaudo del periodo."
      />

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={cn(period === p.id ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
        {period === 'rango' && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {moneyCards.map((c) => (
          <div key={c.label} className="stat-card">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{c.label}</p>
            <p className="font-display mt-2 text-2xl font-semibold text-brand-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ticketCards.map((c) => (
          <div key={c.label} className="stat-card">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{c.label}</p>
            <p className="font-display mt-2 text-2xl font-semibold text-brand-900">
              {c.value.toLocaleString('es-CO')}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="app-card p-5">
          <h2 className="font-display text-xl text-brand-900">Ingresos por día</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.ingresosPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2d4bf" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCop(Number(v ?? 0))} />
                <Bar dataKey="value" fill="#1a5440" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="app-card p-5">
          <h2 className="font-display text-xl text-brand-900">Estados de boletas</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.charts.estadosBoletas} dataKey="value" nameKey="label" outerRadius={90}>
                  {data.charts.estadosBoletas.map((entry, i) => (
                    <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#4a2c1a" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="app-card p-5 xl:col-span-2">
          <h2 className="font-display text-xl text-brand-900">Métodos de pago</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.metodosPago}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2d4bf" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCop(Number(v ?? 0))} />
                <Bar dataKey="value" fill="#c9a24a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
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
