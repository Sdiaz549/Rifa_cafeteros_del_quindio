import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import type { PaymentMethodSummary } from '@shared/types'
import { cn } from '../../lib/cn'

export function PaymentMethodsPage() {
  const [items, setItems] = useState<PaymentMethodSummary[]>([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<PaymentMethodSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const res = await window.api.paymentMethods.list()
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

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await window.api.paymentMethods.upsert({ name: name.trim() })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Método creado')
    setName('')
    await load()
  }

  async function toggle(item: PaymentMethodSummary) {
    const res = await window.api.paymentMethods.upsert({
      id: item.id,
      name: item.name,
      status: item.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    await load()
  }

  async function saveEdit() {
    if (!editing) return
    const res = await window.api.paymentMethods.upsert({
      id: editing.id,
      name: editing.name.trim(),
      status: editing.status
    })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Método actualizado')
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CreditCard size={22} />}
        title="Métodos de pago"
        description="Catálogo que verán los operadores al registrar ventas y abonos."
      />

      <form onSubmit={onCreate} className="app-card flex flex-wrap items-end gap-3 p-5">
        <label className="min-w-60 flex-1 text-sm">
          Nuevo método
          <input
            className="mt-1 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Tarjeta"
            required
          />
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : 'Agregar'}
        </button>
      </form>

      <div className="app-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="text-ink-muted">
                  Cargando…
                </td>
              </tr>
            )}
            {items.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}</td>
                <td>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      m.status === 'ACTIVO' ? 'bg-brand-100 text-brand-800' : 'bg-red-50 text-accent-red'
                    )}
                  >
                    {m.status === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="space-x-3">
                  <button type="button" className="text-sm font-semibold text-brand-800" onClick={() => setEditing(m)}>
                    Editar
                  </button>
                  <button type="button" className="text-sm font-semibold text-brand-800" onClick={() => void toggle(m)}>
                    {m.status === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="app-card w-full max-w-md space-y-3 p-6">
            <h2 className="font-display text-2xl text-brand-900">Editar método</h2>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={() => void saveEdit()}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
