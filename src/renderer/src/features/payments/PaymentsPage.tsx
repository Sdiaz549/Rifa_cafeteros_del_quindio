import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DEFAULT_TICKET_PRICE } from '@shared/constants'
import { formatCop, parseCopInput, formatCopInputValue } from '@shared/money'
import { formatTicketNumber, parseTicketNumber } from '@shared/tickets/numbers'
import { inputDateToIso, todayInputDate } from '@shared/dates'
import type { PaymentMethodSummary, PaymentSummary, SellerSummary, TicketSummary } from '@shared/types'

function paddedTicketInput(raw: string): string {
  const n = parseTicketNumber(raw)
  return n == null ? raw.replace(/\D/g, '').slice(0, 4) : formatTicketNumber(n)
}

const statusLabel: Record<string, string> = {
  SIN_VENDER: 'Sin vender',
  EN_ABONOS: 'En abonos',
  CANCELADA: 'Cancelada',
  PERDIDA: 'Perdida'
}

export function PaymentsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [ticketNumber, setTicketNumber] = useState(() => paddedTicketInput(params.get('boleta') ?? ''))
  const [ticket, setTicket] = useState<TicketSummary | null>(null)
  const [history, setHistory] = useState<PaymentSummary[]>([])
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [sellers, setSellers] = useState<SellerSummary[]>([])
  const [sellerId, setSellerId] = useState('')
  const [buyer, setBuyer] = useState({
    fullName: '',
    documentId: '',
    phone: '',
    address: ''
  })
  const [amount, setAmount] = useState('0')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paidAt, setPaidAt] = useState(todayInputDate)
  const [notes, setNotes] = useState('')
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      const [methodsRes, sellersRes] = await Promise.all([
        window.api.paymentMethods.listActive(),
        window.api.sellers.list({ onlyActive: true, take: 200 })
      ])
      if (methodsRes.ok) {
        setMethods(methodsRes.data)
        if (methodsRes.data[0]) setPaymentMethodId(methodsRes.data[0].id)
      }
      if (sellersRes.ok) setSellers(sellersRes.data)
    })()
  }, [])

  useEffect(() => {
    if (params.get('boleta')) {
      void loadTicket(params.get('boleta')!)
    }
  }, [params])

  function resetBuyer() {
    setBuyer({ fullName: '', documentId: '', phone: '', address: '' })
  }

  async function loadTicket(raw: string) {
    const number = parseTicketNumber(raw)
    if (number == null) {
      toast.error('Número de boleta inválido')
      return
    }
    setLoadingTicket(true)
    const [ticketRes, paymentsRes] = await Promise.all([
      window.api.tickets.getByNumber(number),
      window.api.payments.listByTicket(number)
    ])
    setLoadingTicket(false)
    if (!ticketRes.ok) {
      setTicket(null)
      setHistory([])
      toast.error(ticketRes.error)
      return
    }
    const next = ticketRes.data
    setTicket(next)
    setTicketNumber(formatTicketNumber(next.number))
    setHistory(paymentsRes.ok ? paymentsRes.data : [])
    setSellerId(next.sellerId ?? '')
    resetBuyer()
    setAmount('0')
    setPaidAt(todayInputDate())
    setNotes('')
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
    if (ticket.status === 'CANCELADA' || ticket.status === 'PERDIDA') {
      toast.error('Esta boleta no admite abonos en su estado actual.')
      return
    }

    const pending = ticket.status === 'SIN_VENDER' ? DEFAULT_TICKET_PRICE : ticket.balanceDue
    const value = parseCopInput(amount)
    if (value <= 0) {
      toast.error('El valor del abono debe ser mayor que cero')
      return
    }
    if (value > pending) {
      toast.error('El valor del abono supera el saldo pendiente.')
      return
    }
    if (!paymentMethodId) {
      toast.error('Seleccione método de pago')
      return
    }

    const needsSale = ticket.status === 'SIN_VENDER'
    const chosenSellerId = ticket.sellerId || sellerId
    if (needsSale && !chosenSellerId) {
      toast.error('Seleccione un vendedor')
      return
    }

    if (needsSale && !buyer.fullName.trim()) {
      toast.error('Escriba el nombre del comprador')
      return
    }

    setSubmitting(true)
    const paidAtIso = inputDateToIso(paidAt)
    if (needsSale) {
      const res = await window.api.sales.create({
        ticketNumber: ticket.number,
        sellerId: chosenSellerId,
        buyer: {
          fullName: buyer.fullName.trim(),
          documentId: buyer.documentId.trim() || undefined,
          phone: buyer.phone.trim() || undefined,
          address: buyer.address.trim() || undefined
        },
        amount: DEFAULT_TICKET_PRICE,
        initialPayment: value,
        paymentMethodId,
        soldAt: paidAtIso,
        notes: notes.trim() || undefined
      })
      setSubmitting(false)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Abono registrado correctamente.')
      await loadTicket(String(ticket.number))
      if (res.data.balanceDue === 0) navigate(`/boletas/${ticket.number}`)
      return
    }

    const res = await window.api.payments.create({
      ticketNumber: ticket.number,
      amount: value,
      paymentMethodId,
      paidAt: paidAtIso,
      notes: notes.trim() || undefined,
      origin: 'MANUAL'
    })
    setSubmitting(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Abono registrado correctamente.')
    setAmount('0')
    setPaidAt(todayInputDate())
    setNotes('')
    setTicket(res.data.ticket)
    if (res.data.payment) setHistory((prev) => [...prev, res.data.payment])
    if (res.data.ticket.balanceDue === 0) navigate(`/boletas/${ticket.number}`)
  }

  const canPay =
    ticket != null && (ticket.status === 'SIN_VENDER' || ticket.status === 'EN_ABONOS')
  const pending = ticket
    ? ticket.status === 'SIN_VENDER'
      ? DEFAULT_TICKET_PRICE
      : ticket.balanceDue
    : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Abonos</h1>
        <p className="text-sm text-ink-muted">
          Busque la boleta y registre el abono aquí mismo. Los datos del comprador se guardan solos.
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
                {formatTicketNumber(ticket.number)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Estado</p>
              <p className="font-medium">{statusLabel[ticket.status] ?? ticket.status}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Comprador</p>
              <p className="font-medium">{ticket.buyerName ?? 'Sin registrar'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Vendedor</p>
              <p className="font-medium">{ticket.sellerName ?? 'Sin asignar'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Total abonado</p>
              <p className="font-medium">{formatCop(ticket.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Saldo pendiente</p>
              <p className="text-xl font-semibold text-accent-red">{formatCop(pending)}</p>
            </div>
          </div>

          {canPay ? (
            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-white p-5">
              {!ticket.sellerId && (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Vendedor</span>
                  <select
                    className="w-full rounded-xl border border-line px-3 py-2.5"
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                  >
                    <option value="">Seleccione…</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {ticket.status === 'SIN_VENDER' ? (
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <p className="mb-3 text-sm font-semibold text-brand-900">Datos del comprador</p>
                  <p className="mb-3 text-xs text-ink-muted">
                    Si el comprador ya existe (por cédula o nombre), esta boleta queda en ese mismo
                    comprador.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="rounded-xl border border-line px-3 py-2.5 text-sm"
                      placeholder="Nombre completo"
                      value={buyer.fullName}
                      onChange={(e) => setBuyer((s) => ({ ...s, fullName: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2.5 text-sm"
                      placeholder="Cédula (opcional)"
                      value={buyer.documentId}
                      onChange={(e) => setBuyer((s) => ({ ...s, documentId: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2.5 text-sm"
                      placeholder="Teléfono (opcional)"
                      value={buyer.phone}
                      onChange={(e) => setBuyer((s) => ({ ...s, phone: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2.5 text-sm"
                      placeholder="Dirección (opcional)"
                      value={buyer.address}
                      onChange={(e) => setBuyer((s) => ({ ...s, address: e.target.value }))}
                    />
                  </div>
                </div>
              ) : ticket.buyerName ? (
                <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                  Comprador: <strong>{ticket.buyerName}</strong>. El abono queda en esta boleta.
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Valor del abono</span>
                  <input
                    className="w-full rounded-xl border border-line px-3 py-2.5"
                    value={amount}
                    onChange={(e) => setAmount(formatCopInputValue(e.target.value))}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Método de pago</span>
                  <select
                    className="w-full rounded-xl border border-line px-3 py-2.5"
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(e.target.value)}
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Fecha del abono</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-line px-3 py-2.5"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    required
                  />
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

          {history.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <p className="border-b border-line px-5 py-3 text-sm font-semibold text-brand-900">
                Abonos de esta boleta
              </p>
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-50 text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Valor</th>
                    <th className="px-4 py-2 font-medium">Método</th>
                    <th className="px-4 py-2 font-medium">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{p.sequence}</td>
                      <td className="px-4 py-2.5 font-medium">{formatCop(p.amount)}</td>
                      <td className="px-4 py-2.5">{p.paymentMethodName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{p.notes?.trim() ? p.notes : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
