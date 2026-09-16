import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Grid2X2, List, Ticket, X } from 'lucide-react'
import type { TicketStatus, TicketSummary } from '@shared/types'
import { formatCop } from '@shared/money'
import { formatTicketNumber } from '@shared/tickets/numbers'
import { boardStatsFromPacked, packTicketCell } from '@shared/tickets/board'
import { cn } from '../../lib/cn'
import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../auth/AuthContext'
import { AssignSellerForm } from './AssignSellerForm'
import { TicketBoardCanvas } from './TicketBoardCanvas'

const PAGE_SIZE = 80

const statusClass: Record<TicketStatus, string> = {
  SIN_VENDER: 'ticket-sin-vender',
  EN_ABONOS: 'ticket-en-abonos',
  CANCELADA: 'ticket-cancelada',
  PERDIDA: 'ticket-perdida'
}

const statusLabel: Record<TicketStatus, string> = {
  SIN_VENDER: 'Sin vender',
  EN_ABONOS: 'En abonos',
  CANCELADA: 'Cancelada',
  PERDIDA: 'Perdida'
}

export function TicketsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [query, setQuery] = useState(initialQ)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [status, setStatus] = useState<TicketStatus | ''>('')
  const [items, setItems] = useState<TicketSummary[]>([])
  const [total, setTotal] = useState(0)
  const [boardFirst, setBoardFirst] = useState(0)
  const [packed, setPacked] = useState<number[]>([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null)
  const [assignStep, setAssignStep] = useState<'choose' | 'form'>('choose')
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const itemsRef = useRef<TicketSummary[]>([])
  const totalRef = useRef(0)
  const listGen = useRef(0)
  itemsRef.current = items
  totalRef.current = total

  useEffect(() => {
    setQuery(initialQ)
    setDebouncedQuery(initialQ)
  }, [initialQ])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 180)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const res = await window.api.tickets.board()
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        setPacked([])
      } else {
        setBoardFirst(res.data.first)
        setPacked(res.data.packed)
        setStats(boardStatsFromPacked(res.data.packed))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (view !== 'list') return
    let cancelled = false
    const gen = ++listGen.current
    loadingMoreRef.current = false
    void (async () => {
      const res = await window.api.tickets.list({
        query: debouncedQuery || undefined,
        status: status || undefined,
        take: PAGE_SIZE,
        skip: 0
      })
      if (cancelled || gen !== listGen.current) return
      if (!res.ok) {
        setError(res.error)
        setItems([])
        setTotal(0)
      } else {
        setItems(res.data.items)
        setTotal(res.data.total)
      }
      setLoadingMore(false)
    })()
    return () => {
      cancelled = true
    }
  }, [view, debouncedQuery, status])

  const loadMore = useCallback(async () => {
    if (loading || loadingMoreRef.current) return
    const skip = itemsRef.current.length
    const currentTotal = totalRef.current
    if (skip >= currentTotal && currentTotal > 0) return
    const gen = listGen.current

    loadingMoreRef.current = true
    setLoadingMore(true)
    const res = await window.api.tickets.list({
      query: debouncedQuery || undefined,
      status: status || undefined,
      take: PAGE_SIZE,
      skip
    })
    if (gen !== listGen.current) {
      loadingMoreRef.current = false
      return
    }
    loadingMoreRef.current = false
    setLoadingMore(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTotal(res.data.total)
    if (res.data.items.length === 0) return
    setItems((prev) => {
      const seen = new Set(prev.map((t) => t.id))
      return [...prev, ...res.data.items.filter((t) => !seen.has(t.id))]
    })
  }, [debouncedQuery, status, loading])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading) return
    const root = el.closest('main')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { root: root instanceof Element ? root : null, rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [view, loading, items.length, loadMore])

  const onPick = useCallback(
    (number: number, ticketStatus: TicketStatus, isSettled: boolean) => {
      if (ticketStatus === 'SIN_VENDER' && can('tickets:sell')) {
        setAssignStep('choose')
        setSelectedTicket({
          id: `board-${number}`,
          number,
          status: ticketStatus,
          isSettled,
          sellerId: null,
          sellerName: null,
          buyerId: null,
          buyerName: null,
          totalAmount: 0,
          totalPaid: 0,
          balanceDue: 0,
          soldAt: null
        })
        return
      }
      navigate(`/boletas/${number}`)
    },
    [can, navigate]
  )

  const legend = useMemo(
    () => [
      { label: 'Sin vender', className: 'ticket-sin-vender' },
      { label: 'En abonos', className: 'ticket-en-abonos' },
      { label: 'Cancelada', className: 'ticket-cancelada' },
      { label: 'Perdida', className: 'ticket-perdida' }
    ],
    []
  )

  const summaryCards = [
    { label: 'Total de boletas', value: stats?.total, tone: 'bg-white' },
    { label: 'Vendidas', value: stats?.vendidas, tone: 'bg-brand-50' },
    { label: 'En abonos', value: stats?.enAbonos, tone: 'bg-[#FFE082]' },
    { label: 'Sin vender', value: stats?.disponible, tone: 'bg-white' }
  ]

  function openAvailable(t: TicketSummary) {
    setAssignStep('choose')
    setSelectedTicket(t)
  }

  async function refreshAfterAssign(number: number) {
    const ticketRes = await window.api.tickets.getByNumber(number)
    if (ticketRes.ok) {
      const t = ticketRes.data
      setPacked((prev) => {
        const next = prev.slice()
        const i = number - boardFirst
        if (i >= 0 && i < next.length) next[i] = packTicketCell(t.status, t.isSettled)
        setStats(boardStatsFromPacked(next))
        return next
      })
      setItems((prev) => prev.map((row) => (row.number === number ? { ...row, ...t } : row)))
    }
    setSelectedTicket(null)
    setAssignStep('choose')
  }

  return (
    <div className="space-y-5">
      <div className="app-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            icon={<Ticket size={22} />}
            title="Boletas"
            description="Visualice el estado de todas las boletas de la rifa."
          />
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
              <option value="SIN_VENDER">Sin vender</option>
              <option value="EN_ABONOS">En abonos</option>
              <option value="CANCELADA">Cancelada</option>
              <option value="PERDIDA">Perdida</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-ink-muted">Cargando boletas…</p>}
      {error && <p className="text-accent-red">{error}</p>}

      {!loading && !error && packed.length > 0 && view === 'grid' && (
        <div className="app-card p-4">
          <TicketBoardCanvas
            first={boardFirst}
            packed={packed}
            statusFilter={status}
            query={debouncedQuery}
            onPick={onPick}
          />
          <p className="mt-3 text-center text-xs text-ink-muted">
            {packed.length.toLocaleString('es-CO')} boletas
          </p>
        </div>
      )}

      {!loading && !error && view === 'list' && items.length > 0 && (
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
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-line hover:bg-brand-50/40">
                  <td className="px-4 py-2.5">
                    {t.status === 'SIN_VENDER' && can('tickets:sell') ? (
                      <button
                        type="button"
                        className="font-semibold text-brand-800"
                        onClick={() => openAvailable(t)}
                      >
                        {formatTicketNumber(t.number)}
                        {t.isSettled ? ' · Liq.' : ''}
                      </button>
                    ) : (
                      <Link className="font-semibold text-brand-800" to={`/boletas/${t.number}`}>
                        {formatTicketNumber(t.number)}
                        {t.isSettled ? ' · Liq.' : ''}
                      </Link>
                    )}
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
                  <td className="px-4 py-2.5 text-right">
                    {t.status === 'SIN_VENDER' && can('tickets:sell') && (
                      <button
                        type="button"
                        className="rounded-lg bg-forest px-3 py-1 text-xs font-semibold text-white"
                        onClick={() => {
                          setSelectedTicket(t)
                          setAssignStep('form')
                        }}
                      >
                        Asignar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={view === 'list' ? sentinelRef : undefined} className="h-8" />
          <div className="space-y-2 px-4 py-3 text-center">
            <p className="text-xs text-ink-muted">
              {items.length < total
                ? `Cargando boletas… ${items.length.toLocaleString('es-CO')} de ${total.toLocaleString('es-CO')}`
                : `${total.toLocaleString('es-CO')} boletas`}
            </p>
            {items.length < total && (
              <button type="button" className="btn-ghost text-xs" onClick={() => void loadMore()}>
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && view === 'grid' && packed.length === 0 && (
        <div className="app-card border-dashed p-10 text-center text-ink-muted">
          No hay boletas para mostrar.
        </div>
      )}
      {!loading && !error && view === 'list' && items.length === 0 && (
        <div className="app-card border-dashed p-10 text-center text-ink-muted">
          No hay boletas para mostrar.
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div
            className={cn(
              'max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl',
              assignStep === 'form' ? 'max-w-3xl' : 'max-w-md'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-dash-muted uppercase">
                  Boleta disponible
                </p>
                <h2 className="font-display mt-1 text-3xl font-semibold text-forest">
                  {formatTicketNumber(selectedTicket.number)}
                </h2>
                {selectedTicket.sellerName && (
                  <p className="mt-1 text-sm text-dash-muted">
                    Asignada a {selectedTicket.sellerName}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-ghost px-2 py-2"
                onClick={() => {
                  setSelectedTicket(null)
                  setAssignStep('choose')
                }}
              >
                <X size={16} />
              </button>
            </div>
            {assignStep === 'choose' ? (
              <>
                <p className="mt-3 text-sm text-dash-muted">
                  Asigne esta boleta a un vendedor. No se marca como vendida y no necesita comprador.
                </p>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setSelectedTicket(null)
                      setAssignStep('choose')
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const n = selectedTicket.number
                      setSelectedTicket(null)
                      navigate(`/boletas/${n}`)
                    }}
                  >
                    Ver detalle
                  </button>
                  <button type="button" className="btn-primary" onClick={() => setAssignStep('form')}>
                    Asignar a un vendedor
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <AssignSellerForm
                  ticketNumber={selectedTicket.number}
                  currentSellerName={selectedTicket.sellerName}
                  defaultSellerId={selectedTicket.sellerId}
                  onAssigned={() => void refreshAfterAssign(selectedTicket.number)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
