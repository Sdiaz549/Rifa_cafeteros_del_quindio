import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatDateTimeCo } from '@shared/dates'
import type { BackupSettings, BackupSummary } from '@shared/types'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function BackupsPage() {
  const [items, setItems] = useState<BackupSummary[]>([])
  const [settings, setSettings] = useState<BackupSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [listRes, settingsRes] = await Promise.all([
      window.api.backups.list(),
      window.api.backups.getSettings()
    ])
    setLoading(false)
    if (!listRes.ok) {
      toast.error(listRes.error)
      return
    }
    if (!settingsRes.ok) {
      toast.error(settingsRes.error)
      return
    }
    setItems(listRes.data)
    setSettings(settingsRes.data)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate() {
    setBusy(true)
    const res = await window.api.backups.create({ trigger: 'MANUAL' })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Backup creado: ${res.data.fileName}`)
    await load()
  }

  async function onChooseFolder() {
    const res = await window.api.backups.chooseFolder()
    if (!res.ok) {
      if (res.error !== 'Selección cancelada.') toast.error(res.error)
      return
    }
    toast.success('Carpeta actualizada')
    await load()
  }

  async function onToggle(key: 'autoBackupEnabled' | 'autoBackupOnClose', value: boolean) {
    const res = await window.api.backups.updateSettings({ [key]: value })
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  async function onRestore(backupId: string, fileName: string) {
    if (
      !window.confirm(
        `¿Restaurar ${fileName}?\n\nSe creará un backup de seguridad y se cerrará la sesión.`
      )
    ) {
      return
    }
    setBusy(true)
    const res = await window.api.backups.restore({ backupId })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Backup restaurado. Inicie sesión de nuevo.')
    window.location.hash = '#/login'
    window.location.reload()
  }

  async function onRestoreFromFile() {
    if (
      !window.confirm(
        '¿Restaurar desde un archivo .db?\n\nSe creará un backup de seguridad y se cerrará la sesión.'
      )
    ) {
      return
    }
    setBusy(true)
    const res = await window.api.backups.restore({})
    setBusy(false)
    if (!res.ok) {
      if (res.error !== 'Restauración cancelada.') toast.error(res.error)
      return
    }
    toast.success('Backup restaurado. Inicie sesión de nuevo.')
    window.location.hash = '#/login'
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Backups</h1>
        <p className="text-sm text-ink-muted">
          Copias de seguridad de la base SQLite y restauración controlada.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-lg font-bold text-brand-900">Configuración</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Carpeta</p>
            <p className="truncate text-sm font-medium">{settings?.backupFolder ?? '—'}</p>
          </div>
          <button
            type="button"
            onClick={() => void onChooseFolder()}
            disabled={busy}
            className="rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-50"
          >
            Elegir carpeta
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings?.autoBackupEnabled ?? true}
            onChange={(e) => void onToggle('autoBackupEnabled', e.target.checked)}
          />
          Backup automático habilitado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings?.autoBackupOnClose ?? true}
            onChange={(e) => void onToggle('autoBackupOnClose', e.target.checked)}
          />
          Crear backup al cerrar la aplicación
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={busy}
          className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Procesando…' : 'Crear backup ahora'}
        </button>
        <button
          type="button"
          onClick={() => void onRestoreFromFile()}
          disabled={busy}
          className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-50"
        >
          Restaurar desde archivo…
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {loading ? (
          <p className="p-6 text-sm text-ink-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aún no hay backups registrados.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-brand-50/60 text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Tamaño</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-line/70">
                  <td className="px-4 py-3 font-medium">{b.fileName}</td>
                  <td className="px-4 py-3">{formatDateTimeCo(b.createdAt)}</td>
                  <td className="px-4 py-3">{b.trigger}</td>
                  <td className="px-4 py-3">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-ink-muted">{b.createdByName ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRestore(b.id, b.fileName)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                    >
                      Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
