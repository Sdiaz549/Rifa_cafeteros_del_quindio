import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UserCog } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import type { UserSummary } from '@shared/types'
import { formatDateCo } from '@shared/dates'
import { cn } from '../../lib/cn'

const emptyForm = {
  username: '',
  fullName: '',
  password: '',
  role: 'USER' as 'ADMIN' | 'USER'
}

export function UsersPage() {
  const [items, setItems] = useState<UserSummary[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<UserSummary | null>(null)
  const [editPassword, setEditPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const res = await window.api.users.list()
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
    const res = await window.api.users.create(form)
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Usuario creado')
    setForm(emptyForm)
    await load()
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const res = await window.api.users.update({
      id: editing.id,
      fullName: editing.fullName,
      role: editing.role,
      isActive: editing.isActive,
      password: editPassword || undefined
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Usuario actualizado')
    setEditing(null)
    setEditPassword('')
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<UserCog size={22} />}
        title="Usuarios"
        description="Administre cuentas, roles y estado de acceso al sistema."
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <form onSubmit={onCreate} className="app-card space-y-3 p-5">
          <h2 className="font-display text-xl text-brand-900">Nuevo usuario</h2>
          <input
            placeholder="Usuario"
            value={form.username}
            onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
            required
          />
          <input
            placeholder="Nombre completo"
            value={form.fullName}
            onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
            required
          />
          <input
            type="password"
            placeholder="Contraseña (mín. 8)"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            required
          />
          <select
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as 'ADMIN' | 'USER' }))}
          >
            <option value="USER">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Guardando…' : 'Crear usuario'}
          </button>
        </form>

        <div className="app-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-ink-muted">
                    Cargando…
                  </td>
                </tr>
              )}
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.fullName}</td>
                  <td>{u.username}</td>
                  <td>{u.roleName}</td>
                  <td>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        u.isActive ? 'bg-brand-100 text-brand-800' : 'bg-red-50 text-accent-red'
                      )}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{formatDateCo(u.createdAt)}</td>
                  <td>
                    <button type="button" className="text-sm font-semibold text-brand-800" onClick={() => setEditing(u)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="app-card w-full max-w-md space-y-3 p-6">
            <h2 className="font-display text-2xl text-brand-900">Editar {editing.username}</h2>
            <input
              value={editing.fullName}
              onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
            />
            <select
              value={editing.role}
              onChange={(e) => setEditing({ ...editing, role: e.target.value as 'ADMIN' | 'USER' })}
            >
              <option value="USER">Usuario</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              />
              Activo
            </label>
            <input
              type="password"
              placeholder="Nueva contraseña (opcional)"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
            />
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
