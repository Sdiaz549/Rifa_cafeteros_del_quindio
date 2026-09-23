import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatCop } from '@shared/money'
import { DEFAULT_TICKET_PRICE } from '@shared/constants'
import { formatDateCo } from '@shared/dates'
import type { PaymentSummary, TicketSummary } from '@shared/types'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../../lib/cn'
import { AssignSellerForm } from './AssignSellerForm'
import { SellTicketForm } from '../sales/SellTicketForm'
import { PaymentHistoryTable } from '../payments/PaymentHistoryTable'

const statusTone: Record<string, string> = {
  SIN_VENDER: 'ticket-sin-vender',
  EN_ABONOS: 'ticket-en-abonos',
  CANCELADA: 'ticket-cancelada',
  PERDIDA: 'ticket-perdida'
}

export function TicketDetailPage() {
  const { number } = useParams()
  const [params] = useSearchParams()
  const { can } = useAuth()
  const [ticket, setTicket] = useState<(TicketSummary & { statusLabel?: string }) | null>(null)
  const [payments, setPayments] = useState<PaymentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [markingLost, setMarkingLost] = useState(false)
  const [showSale, setShowSale] = useState(false)
  const [saleSellerId, setSaleSellerId] = useState<string | null>(null)
  const [buyerName, setBuyerName] = useState('')
  const [savingBuyer, setSavingBuyer] = useState(false)

  async function load(n: number) {
    const [ticketRes, paymentsRes] = await Promise.all([
      window.api.tickets.getByNumber(n),
      window.api.payments.listByTicket(n)
    ])
    if (!ticketRes.ok) {
      setError(ticketRes.error)
      setTicket(null)
      setPayments([])
      return
    }
    setTicket(ticketRes.data)
    setBuyerName(ticketRes.data.buyerName ?? '')
    setError(null)
    if (paymentsRes.ok) setPayments(paymentsRes.data)
  }

  useEffect(() => {
    const n = Number(number)
    if (Number.isNaN(n)) {
      setError('Número inválido')
      return
    }
    void load(n)
    setShowSale(false)
    setSaleSellerId(null)
  }, [number])

  useEffect(() => {
    if (!ticket || params.get('asignar') !== '1') return
    document.getElementById(`asignar-${ticket.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [ticket, params])

  async function onMarkLost() {
    if (!ticket) return
    if (!window.confirm(`¿Marcar la boleta ${String(ticket.number).padStart(4, '0')} como PERDIDA?`)) {
      return
    }
    setMarkingLost(true)
    const res = await window.api.tickets.markLost(ticket.number)
    setMarkingLost(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Boleta marcada como perdida')
    setTicket({ ...res.data, statusLabel: 'Perdida' })
  }

  async function onSaveBuyer(e: FormEvent) {
    e.preventDefault()
    if (!ticket) return
    const fullName = buyerName.trim()
    if (fullName.length < 2) {
      toast.error('Escriba el nombre del comprador')
      return
    }
    setSavingBuyer(true)
    const res = await window.api.tickets.setBuyer({
      ticketNumber: ticket.number,
      fullName
    })
    setSavingBuyer(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Comprador guardado')
    await load(ticket.number)
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-accent-red">{error}</p>
        <Link to="/boletas" className="text-brand-800 underline">
          Regresar
        </Link>
      </div>
    )
  }

  if (!ticket) return <p className="text-ink-muted">Cargando…</p>

  const ticketValue = ticket.totalAmount > 0 ? ticket.totalAmount : DEFAULT_TICKET_PRICE
  const ticketBalance = ticket.status === 'SIN_VENDER' ? ticketValue : ticket.balanceDue
  const pending = ticketBalance > 0

  return (
    <div className="space-y-5">
      <div className="app-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-900 px-5 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Detalle de boleta</p>
            <h1 className="font-display text-3xl font-bold">
              Boleta # {String(ticket.number).padStart(4, '0')}
            </h1>
          </div>
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              ticket.isSettled ? 'ticket-liquidada' : cn('text-ink', statusTone[ticket.status])
            )}
          >
            {ticket.isSettled ? 'Liquidada' : (ticket.statusLabel ?? ticket.status)}
          </span>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          <section className="space-y-3 lg:col-span-2">
            <h2 className="font-semibold text-brand-900">Información de la boleta</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">Estado</dt>
                <dd className="font-medium">{ticket.statusLabel ?? ticket.status}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Liquidada</dt>
                <dd className="font-medium">{ticket.isSettled ? 'Sí' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Valor total</dt>
                <dd className="font-medium">{formatCop(ticketValue)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Total abonado</dt>
                <dd className="font-medium">{formatCop(ticket.totalPaid)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Saldo pendiente</dt>
                <dd className={cn('font-bold', pending ? 'text-accent-red' : 'text-brand-800')}>
                  {formatCop(ticketBalance)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Fecha de venta</dt>
                <dd className="font-medium">{formatDateCo(ticket.soldAt)}</dd>
              </div>
            </dl>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-brand-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
                  Vendedor
                </p>
                <p className="mt-1 font-medium">{ticket.sellerName ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-line bg-[#FFF5F5] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-red">
                  Comprador
                </p>
                {can('tickets:sell') ? (
                  <form onSubmit={(e) => void onSaveBuyer(e)} className="mt-2 flex flex-col gap-2">
                    <input
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      placeholder="Nombre del comprador"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={savingBuyer}
                      className="self-start rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {savingBuyer ? 'Guardando…' : ticket.buyerName ? 'Actualizar nombre' : 'Guardar nombre'}
                    </button>
                  </form>
                ) : (
                  <p className="mt-1 font-medium">{ticket.buyerName ?? '—'}</p>
                )}
              </div>
            </div>
          </section>

          <aside
            className={cn(
              'rounded-2xl border p-4',
              statusTone[ticket.status]
            )}
          >
            <p className="text-sm font-semibold">Resumen del estado</p>
            <p className="mt-2 text-sm opacity-90">
              {ticket.status === 'EN_ABONOS'
                ? 'La boleta tiene pagos parciales registrados.'
                : ticket.status === 'SIN_VENDER'
                  ? 'Boleta disponible. Puede asignarla a un vendedor sin marcarla vendida.'
                  : ticket.status === 'CANCELADA'
                    ? 'Boleta cancelada / pagada en su totalidad.'
                    : 'Boleta marcada como perdida.'}
            </p>
            <p className="mt-4 text-xs uppercase tracking-wide opacity-70">Saldo</p>
            <p className="font-display text-2xl font-bold">{formatCop(ticketBalance)}</p>
          </aside>
        </div>
      </div>

      <section className="app-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="font-semibold text-brand-900">Abonos registrados</h2>
          {ticket.status === 'EN_ABONOS' && can('payments:create') && (
            <Link to={`/abonos?boleta=${ticket.number}`} className="btn-primary">
              + Registrar abono
            </Link>
          )}
        </div>
        <PaymentHistoryTable
          payments={payments}
          ticketNumber={ticket.number}
          onChanged={() => void load(ticket.number)}
        />
        <div className="flex flex-wrap justify-between gap-3 border-t border-line bg-brand-50/50 px-5 py-3 text-sm">
          <p>
            Total abonado:{' '}
            <span className="font-semibold text-brand-800">{formatCop(ticket.totalPaid)}</span>
          </p>
          <p>
            Saldo pendiente:{' '}
            <span className={cn('font-semibold', pending ? 'text-accent-red' : 'text-brand-800')}>
              {formatCop(ticket.balanceDue)}
            </span>
          </p>
        </div>
      </section>

      {ticket.status !== 'PERDIDA' && can('tickets:sell') && (
        <div className="app-card p-6">
          {showSale ? (
            <SellTicketForm
              ticketNumber={ticket.number}
              defaultSellerId={saleSellerId ?? ticket.sellerId}
              intent="abono"
              embedded
              onSold={() => {
                setShowSale(false)
                void load(ticket.number)
              }}
              onCancel={() => setShowSale(false)}
            />
          ) : (
            <AssignSellerForm
              ticketNumber={ticket.number}
              currentSellerName={ticket.sellerName}
              defaultSellerId={ticket.sellerId}
              skipAbonoPrompt={ticket.status !== 'SIN_VENDER'}
              onAssigned={() => void load(ticket.number)}
              onWantAbono={(sellerId) => {
                setSaleSellerId(sellerId)
                setShowSale(true)
                void load(ticket.number)
              }}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ticket.status === 'EN_ABONOS' && can('payments:create') && (
          <Link to={`/abonos?boleta=${ticket.number}`} className="btn-primary">
            Registrar abono
          </Link>
        )}
        {ticket.status === 'CANCELADA' && !ticket.isSettled && can('settlements:manage') && (
          <Link to={`/liquidaciones?boleta=${ticket.number}`} className="btn-primary">
            Liquidar boleta
          </Link>
        )}
        {can('tickets:mark_lost') &&
          ticket.status !== 'PERDIDA' &&
          ticket.status !== 'SIN_VENDER' && (
            <button
              type="button"
              disabled={markingLost}
              onClick={() => void onMarkLost()}
              className="btn-danger disabled:opacity-60"
            >
              {markingLost ? 'Marcando…' : 'Anular / marcar perdida'}
            </button>
          )}
        <Link to="/boletas" className="btn-ghost">
          Regresar
        </Link>
      </div>
    </div>
  )
}
