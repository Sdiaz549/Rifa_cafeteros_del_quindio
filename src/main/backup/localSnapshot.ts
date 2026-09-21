import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { format } from 'date-fns'
import { getBackupsPath, getDatabasePath } from '../paths'
import { logError, logInfo } from '../logging/appLogger'

export function buildBackupFileName(date = new Date()): string {
  return `backup_${format(date, 'yyyy-MM-dd_HH-mm-ss')}.db`
}

/**
 * Copia database.db a userData/backups sin tocar Prisma.
 * No sobrescribe: el nombre incluye fecha y hora.
 */
export function snapshotDatabaseFile(reason: string): string | null {
  const source = getDatabasePath()
  if (!existsSync(source) || statSync(source).size <= 0) return null

  const folder = getBackupsPath()
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true })

  let dest = join(folder, buildBackupFileName())
  let n = 1
  while (existsSync(dest)) {
    dest = join(folder, buildBackupFileName().replace('.db', `_${n}.db`))
    n += 1
  }

  copyFileSync(source, dest)
  for (const suffix of ['-wal', '-shm'] as const) {
    if (existsSync(`${source}${suffix}`)) {
      copyFileSync(`${source}${suffix}`, `${dest}${suffix}`)
    }
  }
  logInfo('backup.file', { reason, dest, bytes: statSync(dest).size })
  return dest
}

export function restoreDatabaseFile(sourcePath: string): void {
  const target = getDatabasePath()
  if (!existsSync(sourcePath)) {
    throw new Error('El archivo de backup no existe.')
  }
  copyFileSync(sourcePath, target)
  for (const suffix of ['-wal', '-shm'] as const) {
    const side = `${target}${suffix}`
    if (existsSync(side)) {
      try {
        unlinkSync(side)
      } catch (error) {
        logError('backup.restore.wal', error)
      }
    }
  }
}
