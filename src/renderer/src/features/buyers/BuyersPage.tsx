import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { formatCop } from '@shared/money'
import { formatTicketNumber } from '@shared/tickets/numbers'
import type { BuyerSummary, PaymentSummary } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { PaymentHistoryTable } from '../payments/PaymentHistoryTable'
import { AssignSellerForm } from '../tickets/AssignSellerForm'
import { useAuth } from '../auth/AuthContext'

const statusLabel: Record<string, string> = {
  SIN_VENDER: 'Sin vender',
  EN_ABONOS: 'En abonos',
  CANCELADA: 'Cancelada',
  PERDIDA: 'Perdida'
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
  const [loading, setLoading] = useState(true)

  async function load(q?: string) {
    setLoading(true)
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users size={22} />}
        title="Compradores"
        description="Consulta de compradores, sus boletas y los abonos registrados."
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
                    {ticket.status !== 'PERDIDA' && can('tickets:sell') && (
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
                    {ticket.payments.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-muted">Sin abonos registrados.</p>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-xl border border-line">
                        <PaymentHistoryTable
                          payments={ticket.payments.map(
                            (p, index): PaymentSummary => ({
                              id: p.id,
                              ticketId: '',
                              ticketNumber: ticket.number,
                              type: p.type === 'VENTA_INICIAL' ? 'VENTA_INICIAL' : 'ABONO',
                              amount: p.amount,
                              paidAt: p.paidAt,
                              paymentMethodId: p.paymentMethodId,
                              paymentMethodName: p.paymentMethodName,
                              userId: '',
                              userName: '',
                              origin: 'MANUAL',
                              notes: p.notes,
                              sequence: index + 1,
                              status: p.status
                            })
                          )}
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
