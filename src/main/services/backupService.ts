import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { basename, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { format } from 'date-fns'
import { disconnectPrisma, getPrisma } from '../db/client'
import { getDataDir, getDatabasePath } from '../paths'
import { clearSession, requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { SETTING_KEYS } from '../../shared/constants'
import type { ApiResult, BackupSummary } from '../../shared/types'

export function buildBackupFileName(date = new Date()): string {
  return `backup_rifa_${format(date, 'yyyy-MM-dd_HHmm')}.db`
}

function mapBackup(r: {
  id: string
  fileName: string
  filePath: string
  createdAt: Date
  trigger: string
  createdByUserId: string | null
  sizeBytes: number
  notes: string | null
  createdBy: { fullName: string } | null
}): BackupSummary {
  return {
    id: r.id,
    fileName: r.fileName,
    filePath: r.filePath,
    createdAt: r.createdAt.toISOString(),
    trigger: r.trigger as BackupSummary['trigger'],
    createdByUserId: r.createdByUserId,
    createdByName: r.createdBy?.fullName ?? null,
    sizeBytes: r.sizeBytes,
    notes: r.notes
  }
}

async function readSetting(key: string, fallback = ''): Promise<string> {
  const row = await getPrisma().setting.findUnique({ where: { key } })
  return row?.value ?? fallback
}

async function writeSetting(key: string, value: string, userId?: string): Promise<void> {
  await getPrisma().setting.upsert({
    where: { key },
    create: { key, value, updatedByUserId: userId ?? null },
    update: { value, updatedByUserId: userId ?? null }
  })
}

async function resolveBackupFolder(userId?: string): Promise<string> {
  let folder = await readSetting(SETTING_KEYS.backupFolder, '')
  if (!folder) {
    folder = join(getDataDir(), 'backups')
    await writeSetting(SETTING_KEYS.backupFolder, folder, userId)
  }
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
  return folder
}

export async function getBackupSettings(): Promise<
  ApiResult<{
    backupFolder: string
    autoBackupEnabled: boolean
    autoBackupOnClose: boolean
  }>
> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'backups:manage')
    const folder = await resolveBackupFolder(session.userId)
    const [auto, onClose] = await Promise.all([
      readSetting(SETTING_KEYS.autoBackupEnabled, 'true'),
      readSetting(SETTING_KEYS.autoBackupOnClose, 'true')
    ])
    return {
      ok: true,
      data: {
        backupFolder: folder,
        autoBackupEnabled: auto === 'true',
        autoBackupOnClose: onClose === 'true'
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al leer configuración de backups'
    }
  }
}

export async function updateBackupSettings(input: {
  backupFolder?: string
  autoBackupEnabled?: boolean
  autoBackupOnClose?: boolean
}): Promise<ApiResult<{ saved: true }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'backups:manage')
    if (input.backupFolder != null) {
      if (!existsSync(input.backupFolder)) mkdirSync(input.backupFolder, { recursive: true })
      await writeSetting(SETTING_KEYS.backupFolder, input.backupFolder, session.userId)
    }
    if (input.autoBackupEnabled != null) {
      await writeSetting(
        SETTING_KEYS.autoBackupEnabled,
        input.autoBackupEnabled ? 'true' : 'false',
        session.userId
      )
    }
    if (input.autoBackupOnClose != null) {
      await writeSetting(
        SETTING_KEYS.autoBackupOnClose,
        input.autoBackupOnClose ? 'true' : 'false',
        session.userId
      )
    }
    return { ok: true, data: { saved: true } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al guardar configuración de backups'
    }
  }
}

export async function chooseBackupFolder(): Promise<ApiResult<{ backupFolder: string }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'backups:manage')
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Carpeta de backups',
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: 'Carpeta de backups',
          properties: ['openDirectory', 'createDirectory']
        })
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'Selección cancelada.' }
    }
    await writeSetting(SETTING_KEYS.backupFolder, result.filePaths[0], session.userId)
    return { ok: true, data: { backupFolder: result.filePaths[0] } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al elegir carpeta'
    }
  }
}

export async function createBackup(input?: {
  trigger?: BackupSummary['trigger']
  notes?: string
}): Promise<ApiResult<BackupSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'backups:manage')
    const prisma = getPrisma()
    const trigger = input?.trigger ?? 'MANUAL'
    const folder = await resolveBackupFolder(session.userId)
    const dbPath = getDatabasePath()
    if (!existsSync(dbPath)) {
      return { ok: false, error: 'No se encontró el archivo de base de datos.' }
    }

    try {
      await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);')
    } catch {
      /* ignore */
    }

    const fileName = buildBackupFileName()
    const filePath = join(folder, fileName)
    copyFileSync(dbPath, filePath)
    const sizeBytes = statSync(filePath).size

    const record = await prisma.backupRecord.create({
      data: {
        fileName,
        filePath,
        trigger,
        createdByUserId: session.userId,
        sizeBytes,
        notes: input?.notes ?? null
      },
      include: { createdBy: true }
    })

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        module: 'BACKUPS',
        action: 'BACKUP_CREADO',
        entity: 'BackupRecord',
        entityId: record.id,
        newValue: JSON.stringify({ fileName, filePath, trigger, sizeBytes })
      }
    })

    return { ok: true, data: mapBackup(record) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al crear backup'
    }
  }
}

export async function listBackups(): Promise<ApiResult<BackupSummary[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'backups:manage')
    const rows = await getPrisma().backupRecord.findMany({
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    return { ok: true, data: rows.map(mapBackup) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar backups'
    }
  }
}

export async function restoreBackup(input: {
  backupId?: string
  filePath?: string
}): Promise<ApiResult<{ restored: true; filePath: string }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'backups:manage')
    const userId = session.userId
    const prisma = getPrisma()

    let sourcePath = input.filePath
    if (input.backupId) {
      const row = await prisma.backupRecord.findUnique({ where: { id: input.backupId } })
      if (!row) return { ok: false, error: 'No existe el backup indicado.' }
      sourcePath = row.filePath
    }
    if (!sourcePath) {
      const win = BrowserWindow.getFocusedWindow()
      const open = win
        ? await dialog.showOpenDialog(win, {
            title: 'Restaurar backup',
            properties: ['openFile'],
            filters: [{ name: 'SQLite', extensions: ['db'] }]
          })
        : await dialog.showOpenDialog({
            title: 'Restaurar backup',
            properties: ['openFile'],
            filters: [{ name: 'SQLite', extensions: ['db'] }]
          })
      if (open.canceled || !open.filePaths[0]) {
        return { ok: false, error: 'Restauración cancelada.' }
      }
      sourcePath = open.filePaths[0]
    }
    if (!existsSync(sourcePath)) {
      return { ok: false, error: 'El archivo de backup no existe.' }
    }

    await createBackup({
      trigger: 'PRE_RESTORE',
      notes: `Antes de restaurar ${basename(sourcePath)}`
    })

    await disconnectPrisma()
    copyFileSync(sourcePath, getDatabasePath())
    for (const suffix of ['-wal', '-shm'] as const) {
      const side = `${getDatabasePath()}${suffix}`
      if (existsSync(side)) {
        try {
          unlinkSync(side)
        } catch {
          /* ignore */
        }
      }
    }

    clearSession()
    const restored = getPrisma()
    await restored.auditLog.create({
      data: {
        userId,
        module: 'BACKUPS',
        action: 'BACKUP_RESTAURADO',
        entity: 'Database',
        entityId: sourcePath,
        newValue: JSON.stringify({ filePath: sourcePath })
      }
    })

    return { ok: true, data: { restored: true, filePath: sourcePath } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al restaurar backup'
    }
  }
}

export async function maybeBackupOnClose(): Promise<void> {
  try {
    const prisma = getPrisma()
    const onClose = await prisma.setting.findUnique({
      where: { key: SETTING_KEYS.autoBackupOnClose }
    })
    if (onClose && onClose.value !== 'true') return

    const folder = await resolveBackupFolder()
    try {
      await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);')
    } catch {
      /* ignore */
    }

    const fileName = buildBackupFileName()
    const filePath = join(folder, fileName)
    copyFileSync(getDatabasePath(), filePath)
    const sizeBytes = statSync(filePath).size
    await prisma.backupRecord.create({
      data: {
        fileName,
        filePath,
        trigger: 'ON_CLOSE',
        sizeBytes,
        notes: 'Backup automático al cerrar'
      }
    })

    const files = readdirSync(folder)
      .filter((f) => f.startsWith('backup_rifa_') && f.endsWith('.db'))
      .map((f) => ({ f, mtime: statSync(join(folder, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    for (const old of files.slice(30)) {
      try {
        unlinkSync(join(folder, old.f))
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.error('[backup] on-close failed', e)
  }
}
