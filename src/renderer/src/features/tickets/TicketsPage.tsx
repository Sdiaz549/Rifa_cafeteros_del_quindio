import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { TicketStatus, TicketSummary } from '@shared/types'
import { formatCop } from '@shared/money'
import { cn } from '../../lib/cn'

const statusClass: Record<TicketStatus, string> = {
  DISPONIBLE: 'ticket-disponible',
  EN_ABONOS: 'ticket-en-abonos',
  CANCELADA: 'ticket-cancelada',
  PERDIDA: 'ticket-perdida'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setQuery(initialQ)
  }, [initialQ])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const res = await window.api.tickets.list({
        query: query || undefined,
        status: status || undefined,
        take: 200
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
      { label: 'Sin vender', className: 'ticket-disponible' },
      { label: 'En abonos', className: 'ticket-en-abonos' },
      { label: 'Cancelada', className: 'ticket-cancelada' },
      { label: 'Perdida', className: 'ticket-perdida' }
    ],
    []
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Boletas</h1>
          <p className="text-sm text-ink-muted">{total} resultados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar…"
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="DISPONIBLE">Sin vender</option>
            <option value="EN_ABONOS">En abonos</option>
            <option value="CANCELADA">Canceladas</option>
            <option value="PERDIDA">Perdidas</option>
          </select>
          <div className="overflow-hidden rounded-xl border border-line bg-white text-sm">
            <button
              type="button"
              className={cn('px-3 py-2', view === 'grid' && 'bg-brand-800 text-white')}
              onClick={() => setView('grid')}
            >
              Cuadrícula
            </button>
            <button
              type="button"
              className={cn('px-3 py-2', view === 'list' && 'bg-brand-800 text-white')}
              onClick={() => setView('list')}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {legend.map((l) => (
          <span
            key={l.label}
            className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', l.className)}
          >
            {l.label}
          </span>
        ))}
        <span className="rounded-lg border border-brand-700 px-2.5 py-1 text-xs font-medium text-brand-800">
          ● Liquidada (indicador)
        </span>
      </div>

      {loading && <p className="text-ink-muted">Cargando boletas…</p>}
      {error && <p className="text-accent-red">{error}</p>}

      {!loading && !error && view === 'grid' && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {items.map((t) => (
            <Link
              key={t.id}
              to={`/boletas/${t.number}`}
              className={cn(
                'relative rounded-lg border px-1 py-2 text-center text-xs font-semibold shadow-sm transition hover:scale-[1.03]',
                statusClass[t.status]
              )}
              title={t.buyerName ?? t.sellerName ?? undefined}
            >
              {padNumber(t.number)}
              {t.isSettled && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-800 ring-2 ring-white" />
              )}
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && view === 'list' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
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
                <tr key={t.id} className="border-t border-line hover:bg-surface">
                  <td className="px-4 py-2.5">
                    <Link className="font-semibold text-brand-800" to={`/boletas/${t.number}`}>
                      {padNumber(t.number)}
                      {t.isSettled ? ' · Liq.' : ''}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-md border px-2 py-0.5 text-xs', statusClass[t.status])}>
                      {t.status}
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
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-ink-muted">
          No hay boletas para mostrar. Ejecute el seed de desarrollo.
        </div>
      )}
    </div>
  )
}
