import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCop } from '@shared/money'
import { formatTicketNumber } from '@shared/tickets/numbers'
import type { SellerSummary } from '@shared/types'

const emptyForm = {
  fullName: '',
  documentId: '',
  phone: '',
  address: '',
  status: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
  notes: ''
}

export function SellersPage() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SellerSummary[]>([])
  const [selected, setSelected] = useState<SellerSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    void load()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(query), 250)
    return () => clearTimeout(t)
  }, [query])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await window.api.sellers.upsert({
      fullName: form.fullName.trim(),
      documentId: form.documentId.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Vendedor guardado')
    setForm(emptyForm)
    setSelected(res.data)
    await load(query)
  }

  async function openSeller(id: string) {
    const res = await window.api.sellers.getById(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setSelected(res.data)
    setForm({
      fullName: res.data.fullName,
      documentId: res.data.documentId,
      phone: res.data.phone,
      address: res.data.address ?? '',
      status: res.data.status,
      notes: res.data.notes ?? ''
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Vendedores</h1>
        <p className="text-sm text-ink-muted">Gestión de vendedores y métricas de boletas asignadas.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr_320px]">
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-brand-900">Nuevo / actualizar</h2>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Nombre"
            value={form.fullName}
            onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
            required
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Cédula"
            value={form.documentId}
            onChange={(e) => setForm((s) => ({ ...s, documentId: e.target.value }))}
            required
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Teléfono"
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            required
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
            {saving ? 'Guardando…' : 'Guardar vendedor'}
          </button>
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
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">{s.fullName}</td>
                    <td className="px-4 py-2.5">{s.status}</td>
                    <td className="px-4 py-2.5">{s.ticketsCount ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="text-brand-800 underline"
                        onClick={() => void openSeller(s.id)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-brand-900">Perfil</h2>
          {!selected && <p className="mt-3 text-sm text-ink-muted">Seleccione un vendedor.</p>}
          {selected && (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Nombre</dt>
                <dd className="font-medium">{selected.fullName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Sin vender</dt>
                <dd>{selected.availableCount ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">En abonos</dt>
                <dd>{selected.partialCount ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Canceladas</dt>
                <dd>{selected.paidCount ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Perdidas</dt>
                <dd>{selected.lostCount ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Liquidadas</dt>
                <dd>{selected.settledCount ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Recaudado</dt>
                <dd className="font-medium">{formatCop(selected.collectedTotal ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Pendiente</dt>
                <dd className="font-medium">{formatCop(selected.pendingTotal ?? 0)}</dd>
              </div>
              {(selected.ticketNumbers?.length ?? 0) > 0 && (
                <div className="pt-3">
                  <dt className="text-ink-muted">Boletas asignadas</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {selected.ticketNumbers?.map((n) => (
                      <span
                        key={n}
                        className="rounded-md border border-line bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900"
                      >
                        {formatTicketNumber(n)}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
