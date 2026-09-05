import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatCop } from '@shared/money'
import { formatDateCo } from '@shared/dates'
import type { TicketSummary } from '@shared/types'
import { cn } from '../../lib/cn'

export function TicketDetailPage() {
  const { number } = useParams()
  const [ticket, setTicket] = useState<(TicketSummary & { statusLabel?: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const n = Number(number)
    if (Number.isNaN(n)) {
      setError('Número inválido')
      return
    }
    void (async () => {
      const res = await window.api.tickets.getByNumber(n)
      if (!res.ok) {
        setError(res.error)
        setTicket(null)
      } else {
        setTicket(res.data)
        setError(null)
      }
    })()
  }, [number])

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
          <Link
            to="/abonos"
            className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Registrar abono
          </Link>
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

      <p className="text-sm text-ink-muted">
        Historial de abonos, edición e impresión se completan en fases siguientes.
      </p>
    </div>
  )
}
