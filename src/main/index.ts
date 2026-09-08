import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/register'
import { getDatabaseUrl, getDataDir } from './paths'
import { getPrisma, disconnectPrisma } from './db/client'
import { runMigrations } from './db/migrate'
import { maybeBackupOnClose } from './services/backupService'
import { ensureTicketRange } from './services/ticketService'
import { appendMediaCommandLineSwitches, grantMicrophoneAccess } from './mediaPermissions'

appendMediaCommandLineSwitches()

let quitting = false

app.whenReady().then(async () => {
  grantMicrophoneAccess()
  getDataDir()
  process.env.DATABASE_URL = getDatabaseUrl()

  try {
    await runMigrations()
  } catch (error) {
    console.error('[startup] DB migrate error', error)
  }

  // Touch prisma to ensure connection
  try {
    const prisma = getPrisma()
    await prisma.$connect()
    await ensureTicketRange()
  } catch (error) {
    console.error('[startup] DB connect error', error)
  }

  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void (async () => {
    try {
      await maybeBackupOnClose()
    } finally {
      await disconnectPrisma()
      app.quit()
    }
  })()
})
