import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Grid2X2, List, Ticket } from 'lucide-react'
import type { TicketStatus, TicketSummary } from '@shared/types'
import { formatCop } from '@shared/money'
import { cn } from '../../lib/cn'

const statusClass: Record<TicketStatus, string> = {
  DISPONIBLE: 'ticket-disponible',
  EN_ABONOS: 'ticket-en-abonos',
  CANCELADA: 'ticket-cancelada',
  PERDIDA: 'ticket-perdida'
}

const statusLabel: Record<TicketStatus, string> = {
  DISPONIBLE: 'Disponible',
  EN_ABONOS: 'En abonos',
  CANCELADA: 'Cancelada',
  PERDIDA: 'Perdida'
}

function padNumber(n: number): string {
  return String(n).padStart(4, '0')
}

export function TicketsPage() {
  const [params] = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [query, setQuery] = useState(initialQ)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [status, setStatus] = useState<TicketStatus | ''>('')
  const [items, setItems] = useState<TicketSummary[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setQuery(initialQ)
  }, [initialQ])

  useEffect(() => {
    void window.api.tickets.stats().then((res) => {
      if (res.ok) setStats(res.data)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const res = await window.api.tickets.list({
        query: query || undefined,
        status: status || undefined,
        take: 100
      })
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        setItems([])
        setTotal(0)
      } else {
        setItems(res.data.items)
        setTotal(res.data.total)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [query, status])

  const legend = useMemo(
    () => [
      { label: 'Disponible', className: 'ticket-disponible' },
      { label: 'En abonos', className: 'ticket-en-abonos' },
      { label: 'Cancelada', className: 'ticket-cancelada' },
      { label: 'Perdida', className: 'ticket-perdida' }
    ],
    []
  )

  const summaryCards = [
    { label: 'Total de boletas', value: stats?.total, tone: 'bg-white' },
    { label: 'Vendidas', value: stats?.vendidas, tone: 'bg-brand-50' },
    { label: 'En abonos', value: stats?.enAbonos, tone: 'bg-[#FFF8E1]' },
    { label: 'Disponibles', value: stats?.disponible, tone: 'bg-white' }
  ]

  return (
    <div className="space-y-5">
      <div className="app-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-800">
              <Ticket size={22} />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-brand-900">Boletas</h1>
              <p className="text-sm text-ink-muted">
                Visualice el estado de todas las boletas de la rifa.
              </p>
            </div>
          </div>
          <div className="inline-flex overflow-hidden rounded-xl border border-line bg-white text-sm">
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 font-medium',
                view === 'grid' && 'bg-brand-800 text-white'
              )}
              onClick={() => setView('grid')}
            >
              <Grid2X2 size={16} />
              Cuadrícula
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 font-medium',
                view === 'list' && 'bg-brand-800 text-white'
              )}
              onClick={() => setView('list')}
            >
              <List size={16} />
              Lista
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={cn('stat-card', card.tone)}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {card.label}
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-brand-900">
                {card.value == null ? '…' : card.value.toLocaleString('es-CO')}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {legend.map((item) => (
              <span
                key={item.label}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium',
                  item.className
                )}
              >
                {item.label}
              </span>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar número…"
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand-700/20 focus:ring-2"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand-700/20 focus:ring-2"
            >
              <option value="">Todos los estados</option>
              <option value="DISPONIBLE">Disponible</option>
              <option value="EN_ABONOS">En abonos</option>
              <option value="CANCELADA">Cancelada</option>
              <option value="PERDIDA">Perdida</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-ink-muted">Cargando boletas…</p>}
      {error && <p className="text-accent-red">{error}</p>}

      {!loading && !error && view === 'grid' && (
        <div className="app-card p-4">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {items.map((t) => (
              <Link
                key={t.id}
                to={`/boletas/${t.number}`}
                className={cn('ticket-cell', statusClass[t.status])}
                title={t.buyerName ?? t.sellerName ?? statusLabel[t.status]}
              >
                {padNumber(t.number)}
                {t.isSettled && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-800 ring-2 ring-white" />
                )}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-ink-muted">
            Mostrando {items.length} de {total.toLocaleString('es-CO')} boletas
          </p>
        </div>
      )}

      {!loading && !error && view === 'list' && (
        <div className="app-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50 text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Comprador</th>
                <th className="px-4 py-3 font-medium">Abonado</th>
                <th className="px-4 py-3 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-line hover:bg-brand-50/40">
                  <td className="px-4 py-2.5">
                    <Link className="font-semibold text-brand-800" to={`/boletas/${t.number}`}>
                      {padNumber(t.number)}
                      {t.isSettled ? ' · Liq.' : ''}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs font-medium',
                        statusClass[t.status]
                      )}
                    >
                      {statusLabel[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{t.sellerName ?? '—'}</td>
                  <td className="px-4 py-2.5">{t.buyerName ?? '—'}</td>
                  <td className="px-4 py-2.5">{formatCop(t.totalPaid)}</td>
                  <td className="px-4 py-2.5">{formatCop(t.balanceDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="app-card border-dashed p-10 text-center text-ink-muted">
          No hay boletas para mostrar. Ejecute el seed de desarrollo.
        </div>
      )}
    </div>
  )
}
