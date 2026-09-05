import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatCop, parseCopInput } from '@shared/money'
import { DEFAULT_TICKET_PRICE } from '@shared/constants'
import type { BuyerSummary, PaymentMethodSummary, SellerSummary } from '@shared/types'

export function NewSalePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [ticketNumber, setTicketNumber] = useState(params.get('boleta') ?? '')
  const [sellerId, setSellerId] = useState('')
  const [buyerMode, setBuyerMode] = useState<'existing' | 'new'>('existing')
  const [buyerId, setBuyerId] = useState('')
  const [buyerQuery, setBuyerQuery] = useState('')
  const [buyers, setBuyers] = useState<BuyerSummary[]>([])
  const [sellers, setSellers] = useState<SellerSummary[]>([])
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [amount, setAmount] = useState(String(DEFAULT_TICKET_PRICE))
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
        if (sellersRes.data[0]) setSellerId(sellersRes.data[0].id)
      }
      if (methodsRes.ok) {
        setMethods(methodsRes.data)
        if (methodsRes.data[0]) setPaymentMethodId(methodsRes.data[0].id)
      }
    })()
  }, [])

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
    const number = Number(ticketNumber)
    if (!Number.isInteger(number) || number <= 0) {
      toast.error('Número de boleta inválido')
      return
    }
    const amountValue = parseCopInput(amount)
    const initialValue = parseCopInput(initialPayment || '0')
    if (amountValue <= 0) {
      toast.error('El valor de la boleta debe ser mayor que cero')
      return
    }
    if (initialValue > amountValue) {
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
      ticketNumber: number,
      sellerId,
      buyerId: buyerMode === 'existing' ? buyerId : undefined,
      buyer: buyerMode === 'new' ? newBuyer : undefined,
      amount: amountValue,
      initialPayment: initialValue,
      paymentMethodId,
      notes: notes || undefined
    })
    setSubmitting(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Venta registrada. Boleta ${String(number).padStart(4, '0')}`)
    navigate(`/boletas/${number}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Nueva venta</h1>
        <p className="text-sm text-ink-muted">
          Registre la venta de una boleta disponible. El pago inicial actualiza saldo y estado.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Número de boleta</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              required
            />
          </label>
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
            <span className="mb-1.5 block font-medium">Valor boleta</span>
            <input
              className="w-full rounded-xl border border-line px-3 py-2.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-ink-muted">{formatCop(parseCopInput(amount))}</span>
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
          <label className="block text-sm sm:col-span-2">
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

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Guardando…' : 'Registrar venta'}
          </button>
          <Link to="/boletas" className="rounded-xl border border-line px-5 py-2.5 text-sm">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
