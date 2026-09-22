import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCop, parseCopInput, formatCopInputValue } from '@shared/money'
import { DEFAULT_TICKET_PRICE } from '@shared/constants'
import { inputDateToIso, todayInputDate } from '@shared/dates'
import { formatTicketNumber } from '@shared/tickets/numbers'
import type { PaymentMethodSummary, SellerSummary } from '@shared/types'
import { cn } from '../../lib/cn'

export function SellTicketForm({
  ticketNumber,
  defaultSellerId,
  onSold,
  onCancel,
  intent = 'sale',
  embedded = false
}: {
  ticketNumber: number
  defaultSellerId?: string | null
  onSold?: () => void
  onCancel?: () => void
  intent?: 'sale' | 'abono'
  embedded?: boolean
}) {
  const [sellerId, setSellerId] = useState('')
  const [sellers, setSellers] = useState<SellerSummary[]>([])
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [initialPayment, setInitialPayment] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paidAt, setPaidAt] = useState(todayInputDate)
  const [notes, setNotes] = useState('')
  const [buyer, setBuyer] = useState({
    fullName: '',
    documentId: '',
    phone: '',
    address: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      const [sellersRes, methodsRes] = await Promise.all([
        window.api.sellers.list({ onlyActive: true, take: 200 }),
        window.api.paymentMethods.listActive()
      ])
      if (sellersRes.ok) {
        setSellers(sellersRes.data)
        const assigned = defaultSellerId
          ? sellersRes.data.find((s) => s.id === defaultSellerId)
          : null
        setSellerId(assigned?.id ?? sellersRes.data[0]?.id ?? '')
      }
      if (methodsRes.ok) {
        setMethods(methodsRes.data)
        if (methodsRes.data[0]) setPaymentMethodId(methodsRes.data[0].id)
      }
    })()
  }, [defaultSellerId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const initialValue = parseCopInput(initialPayment || '0')
    if (intent === 'abono' && initialValue <= 0) {
      toast.error('Ingrese el valor del abono')
      return
    }
    if (initialValue > DEFAULT_TICKET_PRICE) {
      toast.error('El pago inicial no puede superar el valor de la boleta')
      return
    }
    if (!sellerId || !paymentMethodId) {
      toast.error('Seleccione vendedor y método de pago')
      return
    }
    if (!buyer.fullName.trim()) {
      toast.error('Escriba el nombre del comprador')
      return
    }

    setSubmitting(true)
    const res = await window.api.sales.create({
      ticketNumber,
      sellerId,
      buyer: {
        fullName: buyer.fullName.trim(),
        documentId: buyer.documentId.trim() || undefined,
        phone: buyer.phone.trim() || undefined,
        address: buyer.address.trim() || undefined
      },
      amount: DEFAULT_TICKET_PRICE,
      initialPayment: initialValue,
      paymentMethodId,
      soldAt: inputDateToIso(paidAt),
      notes: notes || undefined
    })
    setSubmitting(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(
      intent === 'abono'
        ? `Abono registrado. Boleta ${formatTicketNumber(ticketNumber)}`
        : `Venta registrada. Boleta ${formatTicketNumber(ticketNumber)}`
    )
    onSold?.()
  }

  return (
    <form
      id="vender"
      onSubmit={onSubmit}
      className={cn(embedded ? 'space-y-5' : 'app-card space-y-5 p-6')}
    >
      <div>
        <h2 className="font-display text-2xl font-semibold text-brand-900">
          {intent === 'abono' ? 'Registrar abono' : 'Vendida'}
        </h2>
        <p className="text-sm text-ink-muted">
          Boleta {formatTicketNumber(ticketNumber)}.
          {intent === 'abono'
            ? ' Ingrese el valor del abono, el método de pago y el comprador.'
            : ' Complete comprador y pago para marcarla como vendida.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Vendedor</span>
          <select
            className="w-full rounded-xl border border-line px-3 py-2.5"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            required
          >
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
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
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Valor boleta</span>
          <p className="rounded-xl border border-line bg-brand-50 px-3 py-2.5 font-semibold text-brand-900">
            {formatCop(DEFAULT_TICKET_PRICE)}
          </p>
          <span className="mt-1 block text-xs text-ink-muted">Valor fijo. No se puede modificar.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">
            {intent === 'abono' ? 'Valor del abono' : 'Pago inicial'}
          </span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2.5"
            value={initialPayment}
            onChange={(e) => setInitialPayment(formatCopInputValue(e.target.value))}
            placeholder="20,000"
            inputMode="numeric"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">
            {intent === 'abono' ? 'Fecha del abono' : 'Fecha de venta'}
          </span>
          <input
            type="date"
            className="w-full rounded-xl border border-line px-3 py-2.5"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-brand-900">Datos del comprador</p>
        <p className="mb-3 text-xs text-ink-muted">
          Si el comprador ya existe (por cédula o nombre), esta boleta queda en ese mismo comprador.
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

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Observaciones</span>
        <textarea
          className="min-h-20 w-full rounded-xl border border-line px-3 py-2.5"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Ahora no
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : intent === 'abono' ? 'Registrar abono' : 'Vendida'}
        </button>
      </div>
    </form>
  )
}
