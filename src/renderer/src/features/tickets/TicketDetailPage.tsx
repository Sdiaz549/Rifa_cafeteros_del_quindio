import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatCop } from '@shared/money'
import { formatDateCo } from '@shared/dates'
import type { PaymentSummary, TicketSummary } from '@shared/types'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../../lib/cn'

export function TicketDetailPage() {
  const { number } = useParams()
  const { can } = useAuth()
  const [ticket, setTicket] = useState<(TicketSummary & { statusLabel?: string }) | null>(null)
  const [payments, setPayments] = useState<PaymentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [markingLost, setMarkingLost] = useState(false)

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
  }, [number])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">Detalle de boleta</p>
          <h1 className="font-display text-4xl font-bold text-brand-900">
            {String(ticket.number).padStart(4, '0')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {ticket.status === 'DISPONIBLE' && can('tickets:sell') && (
            <Link
              to={`/nueva-venta?boleta=${ticket.number}`}
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Vender
            </Link>
          )}
          {ticket.status === 'EN_ABONOS' && can('payments:create') && (
            <Link
              to={`/abonos?boleta=${ticket.number}`}
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Registrar abono
            </Link>
          )}
          {can('tickets:mark_lost') &&
            ticket.status !== 'PERDIDA' &&
            ticket.status !== 'DISPONIBLE' && (
              <button
                type="button"
                disabled={markingLost}
                onClick={() => void onMarkLost()}
                className="rounded-xl border border-accent-red px-4 py-2 text-sm font-semibold text-accent-red disabled:opacity-60"
              >
                {markingLost ? 'Marcando…' : 'Marcar perdida'}
              </button>
            )}
          <Link to="/boletas" className="rounded-xl border border-line bg-white px-4 py-2 text-sm">
            Regresar
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-5 md:col-span-2">
          <h2 className="font-semibold text-brand-900">Información general</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-muted">Estado</dt>
              <dd className="font-medium">{ticket.statusLabel ?? ticket.status}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Liquidada</dt>
              <dd className="font-medium">{ticket.isSettled ? 'Sí' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Valor</dt>
              <dd className="font-medium">{formatCop(ticket.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total abonado</dt>
              <dd className="font-medium">{formatCop(ticket.totalPaid)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Saldo pendiente</dt>
              <dd className="font-medium">{formatCop(ticket.balanceDue)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Fecha de venta</dt>
              <dd className="font-medium">{formatDateCo(ticket.soldAt)}</dd>
            </div>
          </dl>
        </section>

        <section
          className={cn(
            'rounded-2xl border p-5',
            ticket.status === 'DISPONIBLE' && 'ticket-disponible',
            ticket.status === 'EN_ABONOS' && 'ticket-en-abonos',
            ticket.status === 'CANCELADA' && 'ticket-cancelada',
            ticket.status === 'PERDIDA' && 'ticket-perdida'
          )}
        >
          <h2 className="font-semibold">Vista rápida</h2>
          <p className="mt-3 text-sm opacity-90">Vendedor</p>
          <p className="font-medium">{ticket.sellerName ?? '—'}</p>
          <p className="mt-3 text-sm opacity-90">Comprador</p>
          <p className="font-medium">{ticket.buyerName ?? '—'}</p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-semibold text-brand-900">Historial de abonos</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-50 text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Método</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Origen</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-ink-muted">
                  Sin movimientos registrados.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-2.5">{p.sequence}</td>
                <td className="px-4 py-2.5">{formatDateCo(p.paidAt)}</td>
                <td className="px-4 py-2.5">{p.type}</td>
                <td className="px-4 py-2.5 font-medium">{formatCop(p.amount)}</td>
                <td className="px-4 py-2.5">{p.paymentMethodName}</td>
                <td className="px-4 py-2.5">{p.userName}</td>
                <td className="px-4 py-2.5">{p.origin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
