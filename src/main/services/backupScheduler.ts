import { getPrisma } from '../db/client'
import { SETTING_KEYS } from '../../shared/constants'

let timer: ReturnType<typeof setInterval> | null = null

/**
 * Prepara backups programados / por intervalo de horas.
 * Fase 1: el temporizador queda listo; la UI de configuración se completa en la fase de backups.
 */
export async function startBackupScheduler(
  createBackup: () => Promise<unknown>
): Promise<void> {
  stopBackupScheduler()
  const prisma = getPrisma()
  const [enabled, hours] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.backupScheduledEnabled } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.backupIntervalHours } })
  ])
  if (enabled?.value !== 'true') return
  const intervalHours = Math.max(1, Number(hours?.value) || 24)
  timer = setInterval(
    () => {
      void createBackup()
    },
    intervalHours * 60 * 60 * 1000
  )
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
