import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { getDatabasePath } from '../paths'
import { getPrismaSqlDir } from './prismaEngine'
import { logError, logInfo, logWarn } from '../logging/appLogger'
import { snapshotDatabaseFile } from '../backup/localSnapshot'

const MIGRATIONS_TABLE = '_app_migrations'

export interface MigrationResult {
  applied: string[]
  skipped: string[]
  baseline: boolean
}

export async function applySqlMigrations(prisma: PrismaClient): Promise<MigrationResult> {
  const sqlDir = getPrismaSqlDir()
  const files = existsSync(sqlDir)
    ? readdirSync(sqlDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : []

  if (!files.length) {
    logWarn('db.migrate.none', { sqlDir })
    return { applied: [], skipped: [], baseline: false }
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `)

  const appliedRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM ${MIGRATIONS_TABLE}`
  )
  const appliedSet = new Set(appliedRows.map((r) => r.name))
  const hasTicketTable = await tableExists(prisma, 'Ticket')
  const result: MigrationResult = { applied: [], skipped: [], baseline: false }

  for (const file of files) {
    if (appliedSet.has(file)) {
      result.skipped.push(file)
      continue
    }

    if (file.startsWith('001') && hasTicketTable) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES ('${escapeSql(file)}', datetime('now'))`
      )
      result.skipped.push(file)
      result.baseline = true
      logInfo('db.migrate.baseline', { file })
      continue
    }

    if (existsSync(getDatabasePath())) {
      snapshotDatabaseFile(`pre-migrate:${file}`)
    }

    const sql = readFileSync(join(sqlDir, file), 'utf8')
    try {
      for (const statement of splitSqlStatements(sql)) {
        await prisma.$executeRawUnsafe(statement)
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES ('${escapeSql(file)}', datetime('now'))`
      )
      result.applied.push(file)
      logInfo('db.migrate.applied', { file })
    } catch (error) {
      logError('db.migrate.failed', { file, error })
      throw error
    }
  }

  return result
}

async function tableExists(prisma: PrismaClient, name: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${escapeSql(name)}'`
    )
    return rows.length > 0
  } catch {
    return false
  }
}

export function splitSqlStatements(sql: string): string[] {
  return sql
    .replace(/^\uFEFF/, '')
    .split(';')
    .map((part) =>
      part
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean)
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}
