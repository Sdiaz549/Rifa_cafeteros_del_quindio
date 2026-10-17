import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Carpeta de userData en Windows: %LOCALAPPDATA%\SistemaRifas (nunca OneDrive/Roaming). */
export const APP_USER_DATA_FOLDER = 'SistemaRifas'
export const DATABASE_FILE_NAME = 'database.db'

function packaged(): boolean {
  try {
    return app.isPackaged
  } catch {
    return false
  }
}

/**
 * Debe llamarse una sola vez, antes de app.whenReady().
 * Producción y desarrollo usan LocalAppData: OneDrive en Roaming deja SQLite bloqueada
 * después de borrar o guardar, y hay que cerrar el programa para que vuelva a responder.
 */
export function configureAppIdentity(): void {
  try {
    app.setName(APP_USER_DATA_FOLDER)
    app.setPath('userData', packaged() ? getPackagedDataRoot() : getDevDataRoot())
  } catch (error) {
    console.error('[paths] configureAppIdentity', error)
  }
}

function getLocalAppData(): string {
  if (process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA
  try {
    return join(app.getPath('appData'), '..', 'Local')
  } catch {
    return join(homedir(), 'AppData', 'Local')
  }
}

function getDevDataRoot(): string {
  return join(getLocalAppData(), `${APP_USER_DATA_FOLDER}-dev`)
}

function getPackagedDataRoot(): string {
  return join(getLocalAppData(), APP_USER_DATA_FOLDER)
}

function getRoamingDataRoot(): string {
  try {
    return join(app.getPath('appData'), APP_USER_DATA_FOLDER)
  } catch {
    return join(homedir(), 'AppData', 'Roaming', APP_USER_DATA_FOLDER)
  }
}

/** Raíz persistente de datos (nunca Program Files, asar ni OneDrive). */
export function getUserDataRoot(): string {
  if (packaged()) {
    return app.getPath('userData')
  }
  return getDevDataRoot()
}

/** @deprecated Use getUserDataRoot(). Conservado para llamadas existentes. */
export function getDataDir(): string {
  return getUserDataRoot()
}

export function getDatabasePath(): string {
  return join(getUserDataRoot(), DATABASE_FILE_NAME)
}

export function getBackupsPath(): string {
  return join(getUserDataRoot(), 'backups')
}

export function getLogsPath(): string {
  return join(getUserDataRoot(), 'logs')
}

export function getConfigPath(): string {
  return join(getUserDataRoot(), 'config')
}

/**
 * SQLite no usa connection_limit=1: con transacciones interactivas Prisma deja
 * el único cupo ocupado y el buscador se queda esperando hasta cerrar el programa.
 */
export function sqliteDatabaseUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return `file:${normalized}`
}

export function getDatabaseUrl(): string {
  return sqliteDatabaseUrl(getDatabasePath())
}

export function ensureAppDirectories(): void {
  for (const dir of [getUserDataRoot(), getBackupsPath(), getLogsPath(), getConfigPath()]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

function legacyDatabaseCandidates(): string[] {
  const currentRoot = getUserDataRoot()
  const candidates = [
    join(currentRoot, 'data', 'rifa.db'),
    join(currentRoot, 'rifa.db')
  ]
  // En el .exe nunca usar cwd: al lanzar desde el repo copiaría data/rifa.db de desarrollo.
  if (!packaged()) {
    candidates.push(
      join(process.cwd(), 'data', DATABASE_FILE_NAME),
      join(process.cwd(), 'data', 'rifa.db')
    )
  }
  try {
    const roamingRoot = getRoamingDataRoot()
    const appData = app.getPath('appData')
    candidates.push(
      join(roamingRoot, DATABASE_FILE_NAME),
      join(roamingRoot, 'data', 'rifa.db'),
      join(appData, 'Rifa Cafeteros del Quindío', 'data', 'rifa.db'),
      join(appData, 'Rifa Cafeteros del Quindío', 'database.db'),
      join(appData, 'rifa-cafeteros-del-quindio', 'data', 'rifa.db')
    )
  } catch {
    /* app no listo */
  }
  return candidates
}

/**
 * Si existe una DB antigua (rifa.db) y aún no hay database.db,
 * copia el archivo. Nunca borra el origen.
 */
export function migrateLegacyDatabaseIfNeeded(): string | null {
  const target = getDatabasePath()
  if (existsSync(target) && safeSize(target) > 0) return null

  for (const source of legacyDatabaseCandidates()) {
    if (source === target) continue
    if (!existsSync(source) || safeSize(source) <= 0) continue
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    for (const suffix of ['-wal', '-shm'] as const) {
      if (existsSync(`${source}${suffix}`)) {
        copyFileSync(`${source}${suffix}`, `${target}${suffix}`)
      }
    }
    return source
  }
  return null
}

function safeSize(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

export const AppPathsService = {
  getDatabasePath,
  getBackupsPath,
  getLogsPath,
  getConfigPath,
  getUserDataRoot,
  getDatabaseUrl,
  ensureAppDirectories
}
