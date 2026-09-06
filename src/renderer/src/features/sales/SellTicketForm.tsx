import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCop, parseCopInput } from '@shared/money'
import { DEFAULT_TICKET_PRICE } from '@shared/constants'
import { formatTicketNumber } from '@shared/tickets/numbers'
import type { BuyerSummary, PaymentMethodSummary, SellerSummary } from '@shared/types'

export function SellTicketForm({
  ticketNumber,
  defaultSellerId,
  onSold
}: {
  ticketNumber: number
  defaultSellerId?: string | null
  onSold?: () => void
}) {
  const [sellerId, setSellerId] = useState('')
  const [buyerMode, setBuyerMode] = useState<'existing' | 'new'>('existing')
  const [buyerId, setBuyerId] = useState('')
  const [buyerQuery, setBuyerQuery] = useState('')
  const [buyers, setBuyers] = useState<BuyerSummary[]>([])
  const [sellers, setSellers] = useState<SellerSummary[]>([])
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [initialPayment, setInitialPayment] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [notes, setNotes] = useState('')
  const [newBuyer, setNewBuyer] = useState({
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

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        const res = await window.api.buyers.list({ query: buyerQuery || undefined, take: 30 })
        if (res.ok) setBuyers(res.data)
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [buyerQuery])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const initialValue = parseCopInput(initialPayment || '0')
    if (initialValue > DEFAULT_TICKET_PRICE) {
      toast.error('El pago inicial no puede superar el valor de la boleta')
      return
    }
    if (!sellerId || !paymentMethodId) {
      toast.error('Seleccione vendedor y método de pago')
      return
    }
    if (buyerMode === 'existing' && !buyerId) {
      toast.error('Seleccione un comprador')
      return
    }
    if (buyerMode === 'new' && (!newBuyer.fullName || !newBuyer.documentId || !newBuyer.phone)) {
      toast.error('Complete los datos del comprador nuevo')
      return
    }

    setSubmitting(true)
    const res = await window.api.sales.create({
      ticketNumber,
      sellerId,
      buyerId: buyerMode === 'existing' ? buyerId : undefined,
      buyer: buyerMode === 'new' ? newBuyer : undefined,
      amount: DEFAULT_TICKET_PRICE,
      initialPayment: initialValue,
      paymentMethodId,
      notes: notes || undefined
    })
    setSubmitting(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Venta registrada. Boleta ${formatTicketNumber(ticketNumber)}`)
    onSold?.()
  }

  return (
    <form id="vender" onSubmit={onSubmit} className="app-card space-y-5 p-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-brand-900">Vendida</h2>
        <p className="text-sm text-ink-muted">
          Boleta {formatTicketNumber(ticketNumber)}. Complete comprador y pago para marcarla como vendida.
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
          <span className="mb-1.5 block font-medium">Pago inicial</span>
          <input
            className="w-full rounded-xl border border-line px-3 py-2.5"
            value={initialPayment}
            onChange={(e) => setInitialPayment(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${buyerMode === 'existing' ? 'bg-brand-800 text-white' : 'bg-white'}`}
            onClick={() => setBuyerMode('existing')}
          >
            Comprador existente
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${buyerMode === 'new' ? 'bg-brand-800 text-white' : 'bg-white'}`}
            onClick={() => setBuyerMode('new')}
          >
            Comprador nuevo
          </button>
        </div>

        {buyerMode === 'existing' ? (
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
              placeholder="Buscar por nombre, cédula o teléfono"
              value={buyerQuery}
              onChange={(e) => setBuyerQuery(e.target.value)}
            />
            <select
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              required={buyerMode === 'existing'}
            >
              <option value="">Seleccione…</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName} — {b.documentId}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl border border-line px-3 py-2.5 text-sm"
              placeholder="Nombre completo"
              value={newBuyer.fullName}
              onChange={(e) => setNewBuyer((s) => ({ ...s, fullName: e.target.value }))}
            />
            <input
              className="rounded-xl border border-line px-3 py-2.5 text-sm"
              placeholder="Cédula"
              value={newBuyer.documentId}
              onChange={(e) => setNewBuyer((s) => ({ ...s, documentId: e.target.value }))}
            />
            <input
              className="rounded-xl border border-line px-3 py-2.5 text-sm"
              placeholder="Teléfono"
              value={newBuyer.phone}
              onChange={(e) => setNewBuyer((s) => ({ ...s, phone: e.target.value }))}
            />
            <input
              className="rounded-xl border border-line px-3 py-2.5 text-sm"
              placeholder="Dirección"
              value={newBuyer.address}
              onChange={(e) => setNewBuyer((s) => ({ ...s, address: e.target.value }))}
            />
          </div>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Observaciones</span>
        <textarea
          className="min-h-20 w-full rounded-xl border border-line px-3 py-2.5"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Guardando…' : 'Vendida'}
      </button>
    </form>
  )
}
