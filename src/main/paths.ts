import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

export function getDataDir(): string {
  if (app.isPackaged) {
    const dir = join(app.getPath('userData'), 'data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  }
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getDatabasePath(): string {
  return join(getDataDir(), 'rifa.db')
}

export function getDatabaseUrl(): string {
  const path = getDatabasePath().replace(/\\/g, '/')
  return `file:${path}`
}
