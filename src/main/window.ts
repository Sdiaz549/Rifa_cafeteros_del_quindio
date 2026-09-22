import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { grantMicrophoneAccess } from './mediaPermissions'
import { logError, logInfo } from './logging/appLogger'

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    show: true,
    title: 'Sistema de Rifas',
    backgroundColor: '#0f3d2e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  grantMicrophoneAccess(win.webContents.session)

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.show()
    win.focus()
  })
  win.show()

  win.on('closed', () => {
    logInfo('app.window.closed')
  })
  win.webContents.on('did-finish-load', () => {
    logInfo('app.window.loaded', { url: win.webContents.getURL() })
    if (!win.isDestroyed()) {
      win.show()
      win.focus()
    }
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logError('window.did-fail-load', { code, desc, url })
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    logError('window.render-gone', details)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
