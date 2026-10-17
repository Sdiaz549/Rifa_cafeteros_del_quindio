import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { formatCop } from '@shared/money'
import { publicDocumentId } from '@shared/identity'
import { formatTicketNumber } from '@shared/tickets/numbers'
import type { BuyerSummary, PaymentSummary } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { PaymentHistoryTable } from '../payments/PaymentHistoryTable'
import { AssignSellerForm } from '../tickets/AssignSellerForm'
import { MarkUnusableButtons } from '../tickets/MarkUnusableButtons'
import { useAuth } from '../auth/AuthContext'

const statusLabel: Record<string, string> = {
  SIN_VENDER: 'Sin vender',
  EN_ABONOS: 'En abonos',
  CANCELADA: 'Cancelada',
  PERDIDA: 'Perdida',
  DAÑADA: 'Dañada'
}

function displayDoc(value: string | null | undefined): string {
  if (!value || value.startsWith('SC-')) return '—'
  return value
}

function displayPhone(value: string | null | undefined): string {
  return value?.trim() ? value : '—'
}

export function BuyersPage() {
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<BuyerSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ticketPayments, setTicketPayments] = useState<Record<number, PaymentSummary[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    documentId: '',
    phone: '',
    address: '',
    email: ''
  })

  async function load(q?: string) {
    if (items.length === 0) setLoading(true)
    const res = await window.api.buyers.list({ query: q || undefined, take: 200 })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setItems(res.data)
    setSelectedId((current) =>
      current && res.data.some((b) => b.id === current) ? current : (res.data[0]?.id ?? null)
    )
  }

  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 250 : 0)
    return () => clearTimeout(t)
  }, [query])

  const selected = items.find((b) => b.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) {
      setForm({ fullName: '', documentId: '', phone: '', address: '', email: '' })
      return
    }
    setForm({
      fullName: selected.fullName,
      documentId: publicDocumentId(selected.documentId),
      phone: selected.phone ?? '',
      address: selected.address ?? '',
      email: selected.email ?? ''
    })
  }, [selectedId, selected?.fullName, selected?.documentId, selected?.phone, selected?.address, selected?.email])

  async function saveBuyer(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    const fullName = form.fullName.trim()
    if (fullName.length < 2) {
      toast.error('Escriba el nombre del comprador')
      return
    }
    setSaving(true)
    const res = await window.api.buyers.upsert({
      id: selected.id,
      fullName,
      documentId: form.documentId.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || null,
      email: form.email.trim() || null
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Datos del comprador actualizados')
    await load(query)
  }

  useEffect(() => {
    const tickets = selected?.tickets ?? []
    if (tickets.length === 0) {
      setTicketPayments({})
      return
    }
    let cancelled = false
    void Promise.all(
      tickets.map(async (ticket) => {
        const res = await window.api.payments.listByTicket(ticket.number)
        return [ticket.number, res.ok ? res.data : []] as const
      })
    ).then((rows) => {
      if (!cancelled) setTicketPayments(Object.fromEntries(rows))
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, selected?.tickets])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users size={22} />}
        title="Compradores"
        description="Consulte compradores y actualice nombre, cédula, teléfono o dirección en cualquier momento."
      />

      <input
        className="w-full max-w-xl rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
        placeholder="Buscar por nombre, cédula, teléfono o número de boleta…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="app-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50 text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Cédula</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Boletas</th>
                <th className="px-4 py-3 font-medium">Abonado</th>
                <th className="px-4 py-3 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-ink-muted">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-ink-muted">
                    No hay compradores para mostrar.
                  </td>
                </tr>
              )}
              {items.map((b) => (
                <tr
                  key={b.id}
                  className={`cursor-pointer border-t border-line ${selectedId === b.id ? 'bg-brand-50' : 'hover:bg-dash-bg'}`}
                  onClick={() => setSelectedId(b.id)}
                >
                  <td className="px-4 py-2.5 font-medium">{b.fullName}</td>
                  <td className="px-4 py-2.5">{displayDoc(b.documentId)}</td>
                  <td className="px-4 py-2.5">{displayPhone(b.phone)}</td>
                  <td className="px-4 py-2.5">
                    {(b.ticketNumbers ?? []).map((n) => formatTicketNumber(n)).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5">{formatCop(b.totalPaid ?? 0)}</td>
                  <td className="px-4 py-2.5">{formatCop(b.balanceDue ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="app-card space-y-4 p-5">
          {!selected ? (
            <p className="text-sm text-ink-muted">Seleccione un comprador para ver sus boletas y abonos.</p>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Comprador</p>
                <h2 className="font-display mt-1 text-2xl font-semibold text-brand-900">{selected.fullName}</h2>
                {can('buyers:manage') ? (
                  <form onSubmit={(e) => void saveBuyer(e)} className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      className="rounded-xl border border-line px-3 py-2 text-sm"
                      placeholder="Nombre"
                      value={form.fullName}
                      onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2 text-sm"
                      placeholder="Cédula (opcional)"
                      value={form.documentId}
                      onChange={(e) => setForm((s) => ({ ...s, documentId: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2 text-sm"
                      placeholder="Teléfono (opcional)"
                      value={form.phone}
                      onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2 text-sm"
                      placeholder="Dirección (opcional)"
                      value={form.address}
                      onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                    />
                    <input
                      className="rounded-xl border border-line px-3 py-2 text-sm sm:col-span-2"
                      placeholder="Correo (opcional)"
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"
                    >
                      {saving ? 'Guardando…' : 'Guardar datos'}
                    </button>
                  </form>
                ) : (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-ink-muted">Cédula</dt>
                      <dd className="font-medium">{displayDoc(selected.documentId)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Teléfono</dt>
                      <dd className="font-medium">{displayPhone(selected.phone)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Dirección</dt>
                      <dd className="font-medium">{selected.address || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Correo</dt>
                      <dd className="font-medium">{selected.email || '—'}</dd>
                    </div>
                  </dl>
                )}
              </div>

              {(selected.tickets ?? []).length === 0 ? (
                <p className="text-sm text-ink-muted">Este comprador no tiene boletas asociadas.</p>
              ) : (
                selected.tickets!.map((ticket) => (
                  <div key={ticket.number} className="rounded-2xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/boletas/${ticket.number}`}
                          className="font-display text-xl font-semibold text-brand-800 hover:underline"
                        >
                          Boleta {formatTicketNumber(ticket.number)}
                        </Link>
                        <p className="text-xs text-ink-muted">{statusLabel[ticket.status] ?? ticket.status}</p>
                        <p className="text-xs text-ink-muted">
                          Vendedor: {ticket.sellerName ?? 'Sin asignar'}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>Abonado: <strong>{formatCop(ticket.totalPaid)}</strong></p>
                        <p>Saldo: <strong>{formatCop(ticket.balanceDue)}</strong></p>
                      </div>
                    </div>
                    {ticket.status !== 'PERDIDA' && ticket.status !== 'DAÑADA' && can('tickets:sell') && (
                      <div className="mt-3 rounded-xl border border-line p-3">
                        <AssignSellerForm
                          ticketNumber={ticket.number}
                          currentSellerName={ticket.sellerName}
                          defaultSellerId={ticket.sellerId}
                          skipAbonoPrompt
                          onAssigned={() => void load(query)}
                        />
                      </div>
                    )}
                    <div className="mt-3">
                      <MarkUnusableButtons
                        ticketNumber={ticket.number}
                        status={ticket.status}
                        onDone={() => void load(query)}
                      />
                    </div>
                    {(ticketPayments[ticket.number] ?? []).length === 0 ? (
                      <p className="mt-3 text-sm text-ink-muted">Sin abonos registrados.</p>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-xl border border-line">
                        <PaymentHistoryTable
                          payments={ticketPayments[ticket.number] ?? []}
                          ticketNumber={ticket.number}
                          onChanged={() => void load(query)}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
