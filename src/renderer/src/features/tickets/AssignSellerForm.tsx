import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatTicketNumber } from '@shared/tickets/numbers'
import type { SellerSummary } from '@shared/types'

export function AssignSellerForm({
  ticketNumber,
  currentSellerName,
  defaultSellerId,
  onAssigned
}: {
  ticketNumber: number
  currentSellerName?: string | null
  defaultSellerId?: string | null
  onAssigned?: () => void
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [sellerId, setSellerId] = useState(defaultSellerId ?? '')
  const [sellerQuery, setSellerQuery] = useState('')
  const [sellers, setSellers] = useState<SellerSummary[]>([])
  const [newSeller, setNewSeller] = useState({
    fullName: '',
    documentId: '',
    phone: '',
    address: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await window.api.sellers.list({
          query: sellerQuery || undefined,
          onlyActive: true,
          take: 200
        })
        if (!res.ok) return
        setSellers(res.data)
        setSellerId((current) => {
          if (current && res.data.some((s) => s.id === current)) return current
          if (defaultSellerId && res.data.some((s) => s.id === defaultSellerId)) return defaultSellerId
          return res.data[0]?.id ?? ''
        })
      })()
    }, 200)
    return () => window.clearTimeout(t)
  }, [sellerQuery, defaultSellerId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'existing' && !sellerId) {
      toast.error('Seleccione un vendedor')
      return
    }
    if (mode === 'new' && (!newSeller.fullName || !newSeller.documentId || !newSeller.phone)) {
      toast.error('Complete nombre, cédula y teléfono del vendedor')
      return
    }

    setSubmitting(true)
    const res = await window.api.tickets.assign({
      ticketNumber,
      sellerId: mode === 'existing' ? sellerId : undefined,
      seller: mode === 'new' ? newSeller : undefined
    })
    setSubmitting(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Boleta ${formatTicketNumber(ticketNumber)} asignada al vendedor`)
    onAssigned?.()
  }

  return (
    <form id="asignar" onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold text-brand-900">Asignar a un vendedor</h2>
        <p className="text-sm text-ink-muted">
          Boleta {formatTicketNumber(ticketNumber)}. Queda en el vendedor y sigue disponible; no se
          marca como vendida ni pide comprador.
        </p>
        {currentSellerName && (
          <p className="mt-2 text-sm">
            Vendedor actual: <strong>{currentSellerName}</strong>
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${mode === 'existing' ? 'bg-brand-800 text-white' : 'bg-white border border-line'}`}
          onClick={() => setMode('existing')}
        >
          Vendedor existente
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${mode === 'new' ? 'bg-brand-800 text-white' : 'bg-white border border-line'}`}
          onClick={() => setMode('new')}
        >
          Vendedor nuevo
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            placeholder="Buscar por nombre, cédula o teléfono"
            value={sellerQuery}
            onChange={(e) => setSellerQuery(e.target.value)}
          />
          <select
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            required={mode === 'existing'}
          >
            <option value="">Seleccione…</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.documentId} ({s.ticketsCount ?? 0} boletas)
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-line px-3 py-2.5 text-sm"
            placeholder="Nombre completo"
            value={newSeller.fullName}
            onChange={(e) => setNewSeller((s) => ({ ...s, fullName: e.target.value }))}
            required
          />
          <input
            className="rounded-xl border border-line px-3 py-2.5 text-sm"
            placeholder="Cédula"
            value={newSeller.documentId}
            onChange={(e) => setNewSeller((s) => ({ ...s, documentId: e.target.value }))}
            required
          />
          <input
            className="rounded-xl border border-line px-3 py-2.5 text-sm"
            placeholder="Teléfono"
            value={newSeller.phone}
            onChange={(e) => setNewSeller((s) => ({ ...s, phone: e.target.value }))}
            required
          />
          <input
            className="rounded-xl border border-line px-3 py-2.5 text-sm"
            placeholder="Dirección (opcional)"
            value={newSeller.address}
            onChange={(e) => setNewSeller((s) => ({ ...s, address: e.target.value }))}
          />
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
        {submitting ? 'Guardando…' : 'Asignar a un vendedor'}
      </button>
    </form>
  )
}
