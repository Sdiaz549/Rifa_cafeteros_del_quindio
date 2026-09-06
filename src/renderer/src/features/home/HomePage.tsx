import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Handshake,
  Ticket,
  TicketX,
  TrendingUp,
  Wallet
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useAuth } from '../auth/AuthContext'
import { formatCop } from '@shared/money'
import { formatDateCo } from '@shared/dates'
import type { HomeOverview, TicketStatus } from '@shared/types'
import { cn } from '../../lib/cn'

const PIE_COLORS: Record<string, string> = {
  'Sin vender': '#c5cdc9',
  'En abonos': '#f0c14b',
  Canceladas: '#2e7d32',
  Perdidas: '#e53935'
}

const STATUS_PILL: Record<TicketStatus, string> = {
  DISPONIBLE: 'bg-[#e8ecea] text-[#5c6b64]',
  EN_ABONOS: 'bg-[#ffe082] text-[#5c4400]',
  CANCELADA: 'bg-[#c8f0c0] text-[#1b5e20]',
  PERDIDA: 'bg-[#e53935] text-white'
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  DISPONIBLE: 'Disponible',
  EN_ABONOS: 'En abonos',
  CANCELADA: 'Cancelada',
  PERDIDA: 'Perdida'
}

function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function padTicket(n: number): string {
  return String(n).padStart(4, '0')
}

function firstName(fullName?: string): string {
  return fullName?.trim().split(/\s+/)[0] || 'bienvenido'
}

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="text-xs text-dash-muted">Sin dato comparable</span>
  const up = value >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-[#2e7d32]' : 'text-accent-red')}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {up ? '+' : ''}
      {value}% {label}
    </span>
  )
}

function TicketStat({
  label,
  value,
  total,
  barClass,
  icon
}: {
  label: string
  value: number
  total: number
  barClass: string
  icon?: ReactNode
}) {
  const percent = pct(value, total)
  return (
    <div className="dash-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-dash-muted uppercase">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-semibold text-forest">{value.toLocaleString('es-CO')}</p>
      <p className="text-xs text-dash-muted">{percent}%</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8ecea]">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  )
}

export function HomePage() {
  const { session, can } = useAuth()
  const [data, setData] = useState<HomeOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await window.api.dashboard.home()
      if (!res.ok) setError(res.error)
      else setData(res.data)
    })()
  }, [])

  if (error) return <p className="text-accent-red">{error}</p>
  if (!data) return <p className="text-dash-muted">Cargando inicio…</p>

  const t = data.tickets
  const finance = data.finance

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forest md:text-4xl">
            ¡Hola, {firstName(session?.fullName)}!
          </h1>
          <p className="mt-1 text-sm text-dash-muted">
            Aquí tienes un resumen de la rifa {data.raffleName.replace(/^RIFA\s+/i, '')}.
          </p>
        </div>
        <p className="font-script text-2xl text-forest md:text-3xl">Disciplina · Pasión · Grandes Sueños</p>
      </div>

      {finance && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#cfe8d4] bg-[#e9f6ee] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-forest uppercase">Ingresos hoy</p>
              <TrendingUp size={18} className="text-[#2e7d32]" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{formatCop(finance.ingresosHoy)}</p>
            <div className="mt-1">
              <Delta value={finance.ingresosHoyDeltaPct} label="vs. ayer" />
            </div>
          </div>
          <div className="rounded-2xl border border-[#e4ecd0] bg-[#f4f6e8] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-forest uppercase">Ingresos del mes</p>
              <Banknote size={18} className="text-[#5b8c2a]" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{formatCop(finance.ingresosMes)}</p>
            <div className="mt-1">
              <Delta value={finance.ingresosMesDeltaPct} label="vs. mes anterior" />
            </div>
          </div>
          <div className="rounded-2xl border border-[#f3cfcf] bg-[#fdecec] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#9b1c1c] uppercase">Egresos del mes</p>
              <ArrowDownRight size={18} className="text-accent-red" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{formatCop(finance.egresosMes)}</p>
          </div>
          <div className="rounded-2xl border border-[#cfe0f2] bg-[#eaf3fb] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#1e4b7a] uppercase">Balance del mes</p>
              <Wallet size={18} className="text-[#1e4b7a]" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold text-forest">{formatCop(finance.balanceMes)}</p>
          </div>
        </section>
      )}

      {!finance && !can('dashboard:view') && (
        <p className="text-sm text-dash-muted">Los totales financieros los ve el administrador. Aquí está el estado de las boletas.</p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
        <TicketStat
          label="Total de boletas"
          value={t.total}
          total={t.total}
          barClass="bg-forest"
          icon={<Ticket size={16} className="text-forest" />}
        />
        <TicketStat
          label="Vendidas"
          value={t.vendidas}
          total={t.total}
          barClass="bg-[#2e7d32]"
          icon={<CheckCircle2 size={16} className="text-[#2e7d32]" />}
        />
        <TicketStat
          label="Sin vender"
          value={t.disponible}
          total={t.total}
          barClass="bg-[#9aa3a0]"
          icon={<CircleSlash size={16} className="text-[#9aa3a0]" />}
        />
        <TicketStat
          label="En abonos"
          value={t.enAbonos}
          total={t.total}
          barClass="bg-[#f0c14b]"
          icon={<Clock3 size={16} className="text-[#d4a017]" />}
        />
        <TicketStat
          label="Canceladas"
          value={t.cancelada}
          total={t.total}
          barClass="bg-[#5cb85c]"
          icon={<CheckCircle2 size={16} className="text-[#5cb85c]" />}
        />
        <TicketStat
          label="Perdidas"
          value={t.perdida}
          total={t.total}
          barClass="bg-[#e53935]"
          icon={<TicketX size={16} className="text-[#e53935]" />}
        />
        <TicketStat
          label="Liquidadas"
          value={t.liquidadas}
          total={t.total}
          barClass="bg-[#4a5560]"
          icon={<Handshake size={16} className="text-[#4a5560]" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr_1fr]">
        <div className="dash-card p-5">
          <h2 className="font-display text-lg text-forest">Ingresos de los últimos 7 días</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.ingresos7Dias}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4ebe7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7c74' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7c74' }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatCop(Number(v ?? 0))} />
                <Bar dataKey="value" fill="#05411f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card p-5">
          <h2 className="font-display text-lg text-forest">Boletas por estado</h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.estadosBoletas}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {data.charts.estadosBoletas.map((entry) => (
                    <Cell key={entry.label} fill={PIE_COLORS[entry.label] ?? '#05411f'} stroke="#fff" />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card p-5">
          <h2 className="font-display text-lg text-forest">Top 5 vendedores</h2>
          <p className="text-xs text-dash-muted">Boletas vendidas</p>
          <div className="mt-4 h-60">
            {data.charts.topVendedores.length === 0 ? (
              <p className="pt-10 text-center text-sm text-dash-muted">Aún no hay ventas por vendedor.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.topVendedores} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4ebe7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7c74' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={108} tick={{ fontSize: 11, fill: '#05411f' }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#05411f" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg text-forest">Últimas ventas registradas</h2>
            <Ticket size={16} className="text-forest" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-dash-bg text-[11px] tracking-wide text-dash-muted uppercase">
                <tr>
                  <th className="px-4 py-2 font-semibold">Fecha</th>
                  <th className="px-4 py-2 font-semibold">Boleta</th>
                  <th className="px-4 py-2 font-semibold">Comprador</th>
                  <th className="px-4 py-2 font-semibold">Vendedor</th>
                  <th className="px-4 py-2 font-semibold">Valor</th>
                  <th className="px-4 py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-dash-muted">
                      No hay ventas registradas.
                    </td>
                  </tr>
                )}
                {data.recentSales.map((row) => (
                  <tr key={row.id} className="border-t border-dash-line">
                    <td className="px-4 py-2.5 text-dash-muted">{formatDateCo(row.soldAt)}</td>
                    <td className="px-4 py-2.5">
                      <Link className="font-semibold text-forest hover:underline" to={`/boletas/${row.ticketNumber}`}>
                        {padTicket(row.ticketNumber)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-forest">{row.buyerName}</td>
                    <td className="px-4 py-2.5 text-forest">{row.sellerName}</td>
                    <td className="px-4 py-2.5 font-medium text-forest">{formatCop(row.amount)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_PILL[row.status])}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg text-forest">Últimos abonos registrados</h2>
            <Wallet size={16} className="text-forest" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-dash-bg text-[11px] tracking-wide text-dash-muted uppercase">
                <tr>
                  <th className="px-4 py-2 font-semibold">Fecha</th>
                  <th className="px-4 py-2 font-semibold">Boleta</th>
                  <th className="px-4 py-2 font-semibold">Comprador</th>
                  <th className="px-4 py-2 font-semibold">Valor</th>
                  <th className="px-4 py-2 font-semibold">Método</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-dash-muted">
                      No hay abonos registrados.
                    </td>
                  </tr>
                )}
                {data.recentPayments.map((row) => (
                  <tr key={row.id} className="border-t border-dash-line">
                    <td className="px-4 py-2.5 text-dash-muted">{formatDateCo(row.paidAt)}</td>
                    <td className="px-4 py-2.5">
                      <Link className="font-semibold text-forest hover:underline" to={`/boletas/${row.ticketNumber}`}>
                        {padTicket(row.ticketNumber)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-forest">{row.buyerName}</td>
                    <td className="px-4 py-2.5 font-medium text-forest">{formatCop(row.amount)}</td>
                    <td className="px-4 py-2.5 text-forest">{row.paymentMethodName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
