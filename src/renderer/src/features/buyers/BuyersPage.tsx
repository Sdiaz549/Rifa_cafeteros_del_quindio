import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { formatCop } from '@shared/money'
import type { BuyerSummary } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'

const emptyForm = {
  fullName: '',
  documentId: '',
  phone: '',
  address: '',
  email: '',
  notes: ''
}

export function BuyersPage() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<BuyerSummary[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load(q?: string) {
    setLoading(true)
    const res = await window.api.buyers.list({ query: q || undefined, take: 100 })
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
    const res = await window.api.buyers.upsert({
      fullName: form.fullName.trim(),
      documentId: form.documentId.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Comprador guardado')
    setForm(emptyForm)
    await load(query)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users size={22} />}
        title="Compradores"
        description="Crear, editar y buscar compradores por cédula o nombre."
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <form onSubmit={onSubmit} className="app-card space-y-3 p-5">
          <h2 className="font-semibold text-brand-900">Nuevo / actualizar</h2>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Nombre completo"
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
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Correo (opcional)"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          />
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
            {saving ? 'Guardando…' : 'Guardar comprador'}
          </button>
        </form>

        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
            placeholder="Buscar comprador…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="app-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Cédula</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Boletas</th>
                  <th className="px-4 py-3 font-medium">Saldo</th>
                  <th className="px-4 py-3 font-medium"></th>
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
                      Sin compradores
                    </td>
                  </tr>
                )}
                {items.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">{b.fullName}</td>
                    <td className="px-4 py-2.5">{b.documentId}</td>
                    <td className="px-4 py-2.5">{b.phone}</td>
                    <td className="px-4 py-2.5">{b.ticketsCount ?? 0}</td>
                    <td className="px-4 py-2.5">{formatCop(b.balanceDue ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="text-brand-800 underline"
                        onClick={() =>
                          setForm({
                            fullName: b.fullName,
                            documentId: b.documentId,
                            phone: b.phone,
                            address: b.address ?? '',
                            email: b.email ?? '',
                            notes: b.notes ?? ''
                          })
                        }
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
