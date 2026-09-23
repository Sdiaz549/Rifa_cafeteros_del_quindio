import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { PaymentSummary, TicketSummary } from '@shared/types'
import { formatTicketNumber } from '@shared/tickets/numbers'
import { useAuth } from '../auth/AuthContext'
import { AssignSellerForm } from './AssignSellerForm'
import { PaymentHistoryTable } from '../payments/PaymentHistoryTable'

export function TicketEditModal({
  ticketNumber,
  onClose,
  onChanged
}: {
  ticketNumber: number
  onClose: () => void
  onChanged?: () => void
}) {
  const { can } = useAuth()
  const [ticket, setTicket] = useState<TicketSummary | null>(null)
  const [payments, setPayments] = useState<PaymentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [ticketRes, paymentsRes] = await Promise.all([
      window.api.tickets.getByNumber(ticketNumber),
      window.api.payments.listByTicket(ticketNumber)
    ])
    setLoading(false)
    if (!ticketRes.ok) {
      setError(ticketRes.error)
      setTicket(null)
      setPayments([])
      return
    }
    setError(null)
    setTicket(ticketRes.data)
    setPayments(paymentsRes.ok ? paymentsRes.data : [])
  }

  useEffect(() => {
    void load()
  }, [ticketNumber])

  async function handleChanged() {
    await load()
    onChanged?.()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Editar boleta</p>
            <h2 className="font-display mt-1 text-2xl font-semibold text-brand-900">
              Boleta {formatTicketNumber(ticketNumber)}
            </h2>
          </div>
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {loading && <p className="mt-4 text-sm text-ink-muted">Cargando…</p>}
        {error && <p className="mt-4 text-sm text-accent-red">{error}</p>}

        {ticket && (
          <div className="mt-5 space-y-5">
            {ticket.status !== 'PERDIDA' && can('tickets:sell') && (
              <AssignSellerForm
                ticketNumber={ticket.number}
                currentSellerName={ticket.sellerName}
                defaultSellerId={ticket.sellerId}
                skipAbonoPrompt
                onAssigned={() => void handleChanged()}
              />
            )}

            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-brand-900">Abonos</p>
                {ticket.status === 'EN_ABONOS' && can('payments:create') && (
                  <Link to={`/abonos?boleta=${ticket.number}`} className="text-sm font-semibold text-brand-800">
                    Registrar abono
                  </Link>
                )}
              </div>
              <PaymentHistoryTable
                payments={payments}
                ticketNumber={ticket.number}
                onChanged={() => void handleChanged()}
              />
            </div>

            <div className="flex justify-end">
              <Link to={`/boletas/${ticket.number}`} className="text-sm font-semibold text-brand-800">
                Ver detalle
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function TicketEditButton({
  ticketNumber,
  onChanged,
  children,
  className
}: {
  ticketNumber: number
  onChanged?: () => void
  children?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className ?? 'text-sm font-semibold text-brand-800'}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {children ?? 'Editar'}
      </button>
      {open && (
        <TicketEditModal
          ticketNumber={ticketNumber}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      )}
    </>
  )
}
