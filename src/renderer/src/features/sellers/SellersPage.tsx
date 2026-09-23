import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { canSettle, ticketStatusLabel } from '@shared/domain/ticketStatus'
import { formatCop } from '@shared/money'
import { formatTicketNumber } from '@shared/tickets/numbers'
import { SETTLEMENT_AMOUNT_PER_TICKET } from '@shared/constants'
import type { SellerSummary, SellerTicketSummary } from '@shared/types'
import { useAuth } from '../auth/AuthContext'

const emptyForm = {
  id: '',
  fullName: '',
  documentId: '',
  phone: '',
  address: '',
  status: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
  notes: ''
}

export function SellersPage() {
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SellerSummary[]>([])
  const [selected, setSelected] = useState<SellerSummary | null>(null)
  const [sellerTickets, setSellerTickets] = useState<SellerTicketSummary[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [settling, setSettling] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const [exportingPayments, setExportingPayments] = useState(false)

  async function load(q?: string) {
    setLoading(true)
    const res = await window.api.sellers.list({ query: q || undefined, take: 100 })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setItems(res.data)
  }

  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 250 : 0)
    return () => clearTimeout(t)
  }, [query])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const creating = !form.id
    setSaving(true)
    const res = await window.api.sellers.upsert({
      id: form.id || undefined,
      fullName: form.fullName.trim(),
      documentId: form.documentId.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(creating ? 'Vendedor creado' : 'Vendedor actualizado')
    if (creating) {
      setForm(emptyForm)
      await showSeller(res.data.id, false)
    } else {
      await showSeller(res.data.id, true)
    }
    await load(query)
  }

  async function showSeller(id: string, fillForm: boolean) {
    const res = await window.api.sellers.getById(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    const tickets = (res.data.tickets ?? []).filter((t) => Number.isFinite(t.number))
    setSelected({ ...res.data, tickets, ticketNumbers: tickets.map((t) => t.number) })
    setSellerTickets(tickets)
    setSelecting(false)
    setSelectedNumbers([])
    if (!fillForm) return
    setForm({
      id: res.data.id,
      fullName: res.data.fullName,
      documentId: res.data.documentId?.startsWith('SC-') ? '' : res.data.documentId,
      phone: res.data.phone,
      address: res.data.address ?? '',
      status: res.data.status,
      notes: res.data.notes ?? ''
    })
  }

  async function openSeller(id: string) {
    await showSeller(id, true)
  }

  const tickets = sellerTickets
  const settleable = useMemo(
    () => tickets.filter((t) => canSettle(t.status, t.isSettled) && t.totalPaid > 0),
    [tickets]
  )
  const selectedAmount = selectedNumbers.length * SETTLEMENT_AMOUNT_PER_TICKET

  function toggleTicket(number: number) {
    setSelectedNumbers((current) =>
      current.includes(number) ? current.filter((n) => n !== number) : [...current, number]
    )
  }

  function startSelecting() {
    if (settleable.length === 0) {
      toast.error('Este vendedor no tiene boletas canceladas pendientes de liquidar.')
      return
    }
    setSelecting(true)
    setSelectedNumbers([])
  }

  async function settleSelected() {
    if (selectedNumbers.length === 0) {
      toast.error('Seleccione al menos una boleta')
      return
    }
    setSettling(true)
    let settled = 0
    for (const number of selectedNumbers) {
      const res = await window.api.settlements.create({
        ticketNumber: number,
        amount: SETTLEMENT_AMOUNT_PER_TICKET
      })
      if (!res.ok) {
        setSettling(false)
        toast.error(
          settled > 0
            ? `Se liquidaron ${settled} boletas. Error en ${formatTicketNumber(number)}: ${res.error}`
            : res.error
        )
        if (selected) await openSeller(selected.id)
        return
      }
      settled += 1
    }
    setSettling(false)
    toast.success(
      settled === 1
        ? `Boleta ${formatTicketNumber(selectedNumbers[0])} liquidada`
        : `${settled} boletas liquidadas`
    )
    setSelecting(false)
    setSelectedNumbers([])
    if (selected) await openSeller(selected.id)
    await load(query)
  }

  async function exportWord() {
    if (!selected || exportingWord) return
    if (tickets.length === 0) {
      toast.error('Este vendedor no tiene boletas para exportar.')
      return
    }
    const exportFn = window.api.sellers.exportTicketsWord
    if (typeof exportFn !== 'function') {
      toast.error('Reinicie la aplicación para exportar a Word.')
      return
    }
    setExportingWord(true)
    try {
      const res = await exportFn(selected.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Word descargado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar a Word')
    } finally {
      setExportingWord(false)
    }
  }

  async function exportPayments() {
    if (!selected || exportingPayments) return
    if (tickets.length === 0) {
      toast.error('Este vendedor no tiene boletas para exportar.')
      return
    }
    const exportFn = window.api.sellers.exportPaymentsWord
    if (typeof exportFn !== 'function') {
      toast.error('Reinicie la aplicación para descargar la relación de pagos.')
      return
    }
    setExportingPayments(true)
    try {
      const res = await exportFn(selected.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Relación de pagos descargada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar la relación de pagos')
    } finally {
      setExportingPayments(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Vendedores</h1>
        <p className="text-sm text-ink-muted">Gestión de vendedores y métricas de boletas asignadas.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-brand-900">
            {form.id ? 'Actualizar vendedor' : 'Nuevo vendedor'}
          </h2>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Nombre"
            value={form.fullName}
            onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
            required
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Cédula (opcional)"
            value={form.documentId}
            onChange={(e) => setForm((s) => ({ ...s, documentId: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Teléfono (opcional)"
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Dirección"
            value={form.address}
            onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
          />
          <select
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) =>
              setForm((s) => ({ ...s, status: e.target.value as 'ACTIVO' | 'INACTIVO' }))
            }
          >
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
          <textarea
            className="min-h-20 w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Observaciones"
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-800 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Guardar vendedor'}
          </button>
          {form.id ? (
            <button
              type="button"
              className="w-full rounded-xl border border-line py-2 text-sm font-medium text-brand-900"
              onClick={() => setForm(emptyForm)}
            >
              Nuevo vendedor
            </button>
          ) : null}
        </form>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
            placeholder="Buscar vendedor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50 text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Boletas</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-ink-muted">
                      Cargando…
                    </td>
                  </tr>
                )}
                {items.map((s) => (
                  <tr
                    key={s.id}
                    className={`cursor-pointer border-t border-line ${selected?.id === s.id ? 'bg-brand-50' : 'hover:bg-brand-50/40'}`}
                    onClick={() => void openSeller(s.id)}
                  >
                    <td className="px-4 py-2.5 font-medium">{s.fullName}</td>
                    <td className="px-4 py-2.5">{s.status}</td>
                    <td className="px-4 py-2.5">{s.ticketsCount ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-brand-800 underline">Ver</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-h-0 rounded-2xl border border-line bg-white">
          {!selected ? (
            <p className="p-5 text-sm text-ink-muted">Seleccione un vendedor para ver sus boletas.</p>
          ) : (
            <>
              <div className="border-b border-line p-5">
                <h2 className="font-semibold text-brand-900">{selected.fullName}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Sin vender</dt>
                    <dd>{selected.availableCount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">En abonos</dt>
                    <dd>{selected.partialCount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Canceladas</dt>
                    <dd>{selected.paidCount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Liquidadas</dt>
                    <dd>{selected.settledCount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Recaudado</dt>
                    <dd className="font-medium">{formatCop(selected.collectedTotal ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Pendiente</dt>
                    <dd className="font-medium">{formatCop(selected.pendingTotal ?? 0)}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <p className="text-sm font-semibold text-brand-900">Boletas ({tickets.length})</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-900 disabled:opacity-60"
                    disabled={exportingWord || tickets.length === 0}
                    onClick={() => void exportWord()}
                  >
                    {exportingWord ? 'Exportando…' : 'Exportar a Word'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-900 disabled:opacity-60"
                    disabled={exportingPayments || tickets.length === 0}
                    onClick={() => void exportPayments()}
                  >
                    {exportingPayments ? 'Descargando…' : 'Descargar relación de pagos'}
                  </button>
                  {can('settlements:manage') &&
                    (selecting ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg border border-line px-3 py-1.5 text-xs"
                          disabled={settling}
                          onClick={() => {
                            setSelecting(false)
                            setSelectedNumbers([])
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-line px-3 py-1.5 text-xs"
                          disabled={settling}
                          onClick={() => setSelectedNumbers(settleable.map((t) => t.number))}
                        >
                          Seleccionar todas
                        </button>
                        <button
                          type="button"
                          disabled={settling || selectedNumbers.length === 0}
                          className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          onClick={() => void settleSelected()}
                        >
                          {settling
                            ? 'Liquidando…'
                            : selectedNumbers.length === 0
                              ? 'Liquidar'
                              : `Liquidar ${selectedNumbers.length} · ${formatCop(selectedAmount)}`}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={startSelecting}
                      >
                        Seleccionar boletas para liquidar
                      </button>
                    ))}
                </div>
              </div>

              {selecting && (
                <p className="border-b border-line bg-brand-50 px-5 py-2 text-xs text-brand-900">
                  {selectedNumbers.length === 0
                    ? `Marque las boletas canceladas que va a liquidar. Cada una se liquida a ${formatCop(SETTLEMENT_AMOUNT_PER_TICKET)}.`
                    : `${selectedNumbers.length} boletas · ${formatCop(selectedAmount)} (${formatCop(SETTLEMENT_AMOUNT_PER_TICKET)} c/u)`}
                </p>
              )}

              {tickets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
                  {tickets.map((t) => (
                    <Link
                      key={t.number}
                      to={`/boletas/${t.number}`}
                      className="rounded-md border border-line bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900 hover:bg-brand-100"
                    >
                      {formatTicketNumber(t.number)}
                    </Link>
                  ))}
                </div>
              )}

              {tickets.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted">
                  Este vendedor no tiene boletas asignadas.
                </p>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-brand-50 text-xs uppercase text-ink-muted">
                      <tr>
                        {selecting && <th className="w-10 px-3 py-2" />}
                        <th className="px-3 py-2 font-medium">Boleta</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Abonado</th>
                        <th className="px-3 py-2 font-medium">Saldo</th>
                        {selecting && <th className="px-3 py-2 font-medium">Liquidar</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => {
                        const eligible = canSettle(t.status, t.isSettled) && t.totalPaid > 0
                        return (
                          <tr
                            key={t.number}
                            className={`border-t border-line ${
                              selectedNumbers.includes(t.number) ? 'bg-brand-50' : ''
                            }`}
                          >
                            {selecting && (
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  disabled={!eligible || settling}
                                  checked={selectedNumbers.includes(t.number)}
                                  onChange={() => toggleTicket(t.number)}
                                />
                              </td>
                            )}
                            <td className="px-3 py-2 font-semibold">
                              <Link
                                to={`/boletas/${t.number}`}
                                className="text-brand-800 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {formatTicketNumber(t.number)}
                              </Link>
                            </td>
                            <td className="px-3 py-2">{ticketStatusLabel(t.status)}</td>
                            <td className="px-3 py-2 font-medium">{formatCop(t.totalPaid)}</td>
                            <td className="px-3 py-2">{formatCop(t.balanceDue)}</td>
                            {selecting && (
                              <td className="px-3 py-2 font-medium">
                                {eligible ? formatCop(SETTLEMENT_AMOUNT_PER_TICKET) : '—'}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
