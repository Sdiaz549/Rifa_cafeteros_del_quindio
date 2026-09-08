import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Grid2X2, List, Ticket, X } from 'lucide-react'
import type { TicketStatus, TicketSummary } from '@shared/types'
import { formatCop } from '@shared/money'
import { formatTicketNumber } from '@shared/tickets/numbers'
import { cn } from '../../lib/cn'
import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../auth/AuthContext'
import { AssignSellerForm } from './AssignSellerForm'

const PAGE_SIZE = 500

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
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    void window.api.tickets.stats().then((res) => {
      if (res.ok) setStats(res.data)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const gen = ++listGen.current
    loadingMoreRef.current = false
    void (async () => {
      setLoading(true)
      setError(null)
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
      setLoading(false)
      setLoadingMore(false)
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, status])

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
    if (loading || items.length >= total || total === 0) return
    void loadMore()
  }, [loading, items.length, total, loadMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '800px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [view, loading, items.length, loadMore])

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
    { label: 'En abonos', value: stats?.enAbonos, tone: 'bg-[#FFE082]' },
    { label: 'Disponibles', value: stats?.disponible, tone: 'bg-[#FFF9C4]' }
  ]

  function openAvailable(t: TicketSummary) {
    setAssignStep('choose')
    setSelectedTicket(t)
  }

  function onCellClick(e: MouseEvent, t: TicketSummary) {
    if (t.status === 'DISPONIBLE' && can('tickets:sell')) {
      e.preventDefault()
      openAvailable(t)
    }
  }

  async function refreshAfterAssign(number: number) {
    const [ticketRes, statsRes] = await Promise.all([
      window.api.tickets.getByNumber(number),
      window.api.tickets.stats()
    ])
    if (ticketRes.ok) {
      setItems((prev) => prev.map((t) => (t.number === number ? { ...t, ...ticketRes.data } : t)))
    }
    if (statsRes.ok) setStats(statsRes.data)
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

      {!loading && !error && items.length > 0 && view === 'grid' && (
        <div className="app-card p-4">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {items.map((t) => (
              <Link
                key={t.id}
                to={`/boletas/${t.number}`}
                onClick={(e) => onCellClick(e, t)}
                className={cn('ticket-cell', statusClass[t.status])}
                title={t.buyerName ?? t.sellerName ?? statusLabel[t.status]}
              >
                {formatTicketNumber(t.number)}
                {t.isSettled && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-800 ring-2 ring-white" />
                )}
              </Link>
            ))}
          </div>
          <div ref={sentinelRef} className="h-8" />
          <div className="mt-2 space-y-2 text-center">
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

      {!loading && !error && items.length > 0 && view === 'list' && (
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
                    {t.status === 'DISPONIBLE' && can('tickets:sell') ? (
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
                    {t.status === 'DISPONIBLE' && can('tickets:sell') && (
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

      {!loading && !error && items.length === 0 && (
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
