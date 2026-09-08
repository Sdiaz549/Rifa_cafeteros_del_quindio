import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatCop, parseCopInput } from '@shared/money'
import { formatTicketNumber, parseTicketNumber } from '@shared/tickets/numbers'
import type { PaymentMethodSummary, TicketSummary } from '@shared/types'

function paddedTicketInput(raw: string): string {
  const n = parseTicketNumber(raw)
  return n == null ? raw.replace(/\D/g, '').slice(0, 4) : formatTicketNumber(n)
}

export function PaymentsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [ticketNumber, setTicketNumber] = useState(() => paddedTicketInput(params.get('boleta') ?? ''))
  const [ticket, setTicket] = useState<TicketSummary | null>(null)
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [amount, setAmount] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await window.api.paymentMethods.listActive()
      if (res.ok) {
        setMethods(res.data)
        if (res.data[0]) setPaymentMethodId(res.data[0].id)
      }
    })()
  }, [])

  useEffect(() => {
    if (params.get('boleta')) {
      void loadTicket(params.get('boleta')!)
    }
  }, [params])

  async function loadTicket(raw: string) {
    const number = Number(raw)
    if (!Number.isInteger(number) || number < 0) {
      toast.error('Número de boleta inválido')
      return
    }
    setLoadingTicket(true)
    const res = await window.api.tickets.getByNumber(number)
    setLoadingTicket(false)
    if (!res.ok) {
      setTicket(null)
      toast.error(res.error)
      return
    }
    setTicket(res.data)
    setTicketNumber(formatTicketNumber(res.data.number))
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    const padded = paddedTicketInput(ticketNumber)
    setTicketNumber(padded)
    await loadTicket(padded)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ticket) {
      toast.error('Busque primero la boleta')
      return
    }
    const value = parseCopInput(amount)
    if (value <= 0) {
      toast.error('El valor del abono debe ser mayor que cero')
      return
    }
    if (value > ticket.balanceDue) {
      toast.error('El valor del abono supera el saldo pendiente.')
      return
    }
    if (!paymentMethodId) {
      toast.error('Seleccione método de pago')
      return
    }

    setSubmitting(true)
    const res = await window.api.payments.create({
      ticketNumber: ticket.number,
      amount: value,
      paymentMethodId,
      notes: notes || undefined,
      origin: 'MANUAL'
    })
    setSubmitting(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    toast.success('Abono registrado correctamente.')
    setAmount('')
    setNotes('')
    setTicket(res.data.ticket)
    if (res.data.ticket.balanceDue === 0) {
      navigate(`/boletas/${ticket.number}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Abonos</h1>
        <p className="text-sm text-ink-muted">
          Busque la boleta, verifique el saldo y registre el abono. No se permiten valores superiores
          al pendiente.
        </p>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-4">
        <input
          className="min-w-48 flex-1 rounded-xl border border-line px-3 py-2.5"
          placeholder="0000"
          inputMode="numeric"
          maxLength={4}
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onBlur={() => setTicketNumber(paddedTicketInput(ticketNumber))}
        />
        <button
          type="submit"
          className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {loadingTicket ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {ticket && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-ink-muted">Boleta</p>
              <p className="text-2xl font-semibold text-brand-900">
                {String(ticket.number).padStart(4, '0')}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Estado</p>
              <p className="font-medium">{ticket.status}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Comprador</p>
              <p className="font-medium">{ticket.buyerName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Vendedor</p>
              <p className="font-medium">{ticket.sellerName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Total abonado</p>
              <p className="font-medium">{formatCop(ticket.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Saldo pendiente</p>
              <p className="text-xl font-semibold text-accent-red">{formatCop(ticket.balanceDue)}</p>
            </div>
          </div>

          {ticket.balanceDue > 0 && ticket.status === 'EN_ABONOS' ? (
            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-white p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Valor del abono</span>
                  <input
                    className="w-full rounded-xl border border-line px-3 py-2.5"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Método de pago</span>
                  <select
                    className="w-full rounded-xl border border-line px-3 py-2.5"
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(e.target.value)}
                    required
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Observación</span>
                <textarea
                  className="min-h-20 w-full rounded-xl border border-line px-3 py-2.5"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? 'Registrando…' : 'Registrar abono'}
                </button>
                <Link
                  to={`/boletas/${ticket.number}`}
                  className="rounded-xl border border-line px-5 py-2.5 text-sm"
                >
                  Ver boleta
                </Link>
              </div>
            </form>
          ) : (
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              Esta boleta no admite abonos en su estado actual.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
