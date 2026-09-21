import { useState } from 'react'
import { Cloud, HardDrive, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTimeCo } from '@shared/dates'
import type { DashboardBackupCard } from '@shared/types'
import { cn } from '../lib/cn'

export function BackupStatusCard({
  backup,
  onCreated
}: {
  backup: DashboardBackupCard | null
  onCreated?: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function createNow() {
    setBusy(true)
    const res = await window.api.backups.create({ trigger: 'MANUAL' })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Respaldo local creado')
    onCreated?.()
  }

  const status = backup?.status ?? 'PENDING'
  const statusClass =
    status === 'UPLOADED'
      ? 'bg-[#e9f6ee] text-[#1b5e20]'
      : status === 'ERROR'
        ? 'bg-[#fdecec] text-[#9b1c1c]'
        : 'bg-[#fff8e1] text-[#8a6d00]'

  return (
    <div className="dash-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-dash-muted uppercase">
            Copias de seguridad
          </p>
          <h2 className="font-display mt-1 text-lg text-forest">Último respaldo</h2>
        </div>
        <HardDrive size={18} className="text-forest" />
      </div>

      <p className="mt-3 text-2xl font-semibold text-forest">
        {backup?.lastBackupAt ? formatDateTimeCo(backup.lastBackupAt) : 'Aún no hay respaldos'}
      </p>
      {backup?.fileName && (
        <p className="mt-1 truncate text-xs text-dash-muted" title={backup.localPath ?? undefined}>
          {backup.fileName}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', statusClass)}>
          <Cloud size={13} />
          {backup?.statusLabel ?? 'Pendiente'}
        </span>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void createNow()}
        className="btn-primary mt-auto inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <HardDrive size={16} />}
        {busy ? 'Creando…' : 'Crear respaldo ahora'}
      </button>
    </div>
  )
}
