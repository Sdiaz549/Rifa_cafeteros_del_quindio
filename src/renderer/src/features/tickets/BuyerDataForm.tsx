import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { publicDocumentId } from '@shared/identity'
import type { TicketSummary } from '@shared/types'

export function BuyerDataForm({
  ticket,
  onSaved
}: {
  ticket: TicketSummary
  onSaved?: () => void
}) {
  const [fullName, setFullName] = useState(ticket.buyerName ?? '')
  const [documentId, setDocumentId] = useState(publicDocumentId(ticket.buyerDocumentId))
  const [phone, setPhone] = useState(ticket.buyerPhone ?? '')
  const [address, setAddress] = useState(ticket.buyerAddress ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFullName(ticket.buyerName ?? '')
    setDocumentId(publicDocumentId(ticket.buyerDocumentId))
    setPhone(ticket.buyerPhone ?? '')
    setAddress(ticket.buyerAddress ?? '')
  }, [ticket.buyerId, ticket.buyerName, ticket.buyerDocumentId, ticket.buyerPhone, ticket.buyerAddress])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (name.length < 2) {
      toast.error('Escriba el nombre del comprador')
      return
    }
    setSaving(true)
    const res = await window.api.tickets.setBuyer({
      ticketNumber: ticket.number,
      fullName: name,
      documentId: documentId.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Datos del comprador guardados')
    onSaved?.()
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-brand-900">Datos del comprador</p>
        <p className="mt-1 text-xs text-ink-muted">
          Puede guardar solo el nombre y completar cédula, teléfono o dirección cuando quiera.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          placeholder="Cédula (opcional)"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          placeholder="Dirección (opcional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Guardando…' : ticket.buyerId ? 'Actualizar datos' : 'Guardar comprador'}
      </button>
    </form>
  )
}
