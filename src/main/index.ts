import { app, BrowserWindow, dialog } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/register'
import {
  configureAppIdentity,
  ensureAppDirectories,
  getBackupsPath,
  getConfigPath,
  getDatabasePath,
  getDatabaseUrl,
  getLogsPath,
  getUserDataRoot,
  migrateLegacyDatabaseIfNeeded
} from './paths'
import { configurePrismaEngine } from './db/prismaEngine'
import { getPrisma, disconnectPrisma, resetPrismaClient, configureSqlite } from './db/client'
import { runMigrations } from './db/migrate'
import { ensureRequiredData } from './db/bootstrap'
import { maybeBackupOnClose, createBackup } from './services/backupService'
import { startBackupScheduler } from './services/backupScheduler'
import { registerDefaultVoiceHandlers } from './services/voiceCommandService'
import { warmupWindowsSpeech } from './services/windowsSpeech'
import { ensureTicketRange } from './services/ticketService'
import { appendMediaCommandLineSwitches, grantMicrophoneAccess } from './mediaPermissions'
import { errorToLog, logError, logInfo } from './logging/appLogger'

configureAppIdentity()
appendMediaCommandLineSwitches()

const DATABASE_OPEN_ERROR =
  'No fue posible abrir la base de datos del sistema. No se realizó ninguna modificación. Contacte al administrador.'

let quitting = false

app.whenReady().then(async () => {
  grantMicrophoneAccess()
  ensureAppDirectories()
  configurePrismaEngine()

  const legacy = migrateLegacyDatabaseIfNeeded()
  process.env.DATABASE_URL = getDatabaseUrl()

  logInfo('app.start', {
    version: app.getVersion(),
    packaged: app.isPackaged,
    userData: getUserDataRoot(),
    database: getDatabasePath(),
    backups: getBackupsPath(),
    logs: getLogsPath(),
    config: getConfigPath(),
    legacyCopiedFrom: legacy
  })

  try {
    await initializeDatabase()
  } catch (error) {
    logError('app.database.openFailed', errorToLog(error))
    dialog.showErrorBox('Sistema de Rifas', DATABASE_OPEN_ERROR)
    app.quit()
    return
  }

  registerDefaultVoiceHandlers()
  registerIpcHandlers()
  createMainWindow()
  logInfo('app.window.created')
  warmupWindowsSpeech()
  void startBackupScheduler(async () => {
    await createBackup({ trigger: 'INTERVAL', notes: 'Backup automático por intervalo' })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

async function initializeDatabase(): Promise<void> {
  const prisma = getPrisma()
  logInfo('prisma.connect.start')
  await prisma.$connect()
  await configureSqlite()
  logInfo('prisma.connect.ok')

  try {
    await runMigrations()
    await ensureRequiredData()
    await ensureTicketRange()
    logInfo('db.init.ok')
  } catch (error) {
    logError('db.init.failed', errorToLog(error))
    await disconnectPrisma()
    resetPrismaClient()
    throw error
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void (async () => {
    try {
      logInfo('app.closing')
      await maybeBackupOnClose()
    } catch (error) {
      logError('app.close.backupFailed', errorToLog(error))
    } finally {
      await disconnectPrisma()
      logInfo('app.closed')
      app.quit()
    }
  })()
})
