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
  confirmPassword: '',
  role: 'USER' as 'ADMIN' | 'USER'
}

export function UsersPage({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<UserSummary[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<UserSummary | null>(null)
  const [editPassword, setEditPassword] = useState('')
  const [editConfirm, setEditConfirm] = useState('')
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
    if (form.password !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    const res = await window.api.users.create({
      username: form.username,
      fullName: form.fullName,
      password: form.password,
      role: form.role
    })
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
    if (editPassword && editPassword !== editConfirm) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    const res = await window.api.users.update({
      id: editing.id,
      username: editing.username,
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
    toast.success(editPassword ? 'Usuario y contraseña actualizados' : 'Usuario actualizado')
    setEditing(null)
    setEditPassword('')
    setEditConfirm('')
    await load()
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          icon={<UserCog size={22} />}
          title="Usuarios"
          description="Cree cuentas, cambie usuarios y contraseñas, y active o desactive el acceso."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <form onSubmit={onCreate} className="app-card space-y-3 p-5">
          <h2 className="font-display text-xl text-brand-900">Nuevo usuario</h2>
          <label className="text-sm">
            Usuario
            <input
              className="mt-1 w-full"
              placeholder="ej. operador"
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
              required
              minLength={3}
            />
          </label>
          <label className="text-sm">
            Nombre completo
            <input
              className="mt-1 w-full"
              placeholder="Nombre y apellido"
              value={form.fullName}
              onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
              required
            />
          </label>
          <label className="text-sm">
            Contraseña
            <input
              className="mt-1 w-full"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              required
              minLength={8}
            />
          </label>
          <label className="text-sm">
            Confirmar contraseña
            <input
              className="mt-1 w-full"
              type="password"
              placeholder="Repita la contraseña"
              value={form.confirmPassword}
              onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
              required
              minLength={8}
            />
          </label>
          <label className="text-sm">
            Rol
            <select
              className="mt-1 w-full"
              value={form.role}
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as 'ADMIN' | 'USER' }))}
            >
              <option value="USER">Usuario (operación diaria)</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
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
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-ink-muted">
                    No hay usuarios.
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
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-800"
                      onClick={() => {
                        setEditing(u)
                        setEditPassword('')
                        setEditConfirm('')
                      }}
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

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="app-card w-full max-w-md space-y-3 p-6">
            <h2 className="font-display text-2xl text-brand-900">Editar usuario</h2>
            <label className="text-sm">
              Usuario
              <input
                className="mt-1 w-full"
                value={editing.username}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                minLength={3}
              />
            </label>
            <label className="text-sm">
              Nombre completo
              <input
                className="mt-1 w-full"
                value={editing.fullName}
                onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Rol
              <select
                className="mt-1 w-full"
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value as 'ADMIN' | 'USER' })}
              >
                <option value="USER">Usuario (operación diaria)</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              />
              Activo
            </label>
            <label className="text-sm">
              Nueva contraseña
              <input
                className="mt-1 w-full"
                type="password"
                placeholder="Déjela vacía si no va a cambiarla"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={8}
              />
            </label>
            {editPassword ? (
              <label className="text-sm">
                Confirmar nueva contraseña
                <input
                  className="mt-1 w-full"
                  type="password"
                  placeholder="Repita la nueva contraseña"
                  value={editConfirm}
                  onChange={(e) => setEditConfirm(e.target.value)}
                  minLength={8}
                />
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditing(null)
                  setEditPassword('')
                  setEditConfirm('')
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveEdit()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
