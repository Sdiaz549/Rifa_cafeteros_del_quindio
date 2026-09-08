import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { app } from 'electron'
import { getDatabaseUrl } from '../paths'
import { getPrisma } from './client'

const execFileAsync = promisify(execFile)

function resolvePrismaResource(...parts: string[]): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, ...parts)
  }
  return join(process.cwd(), ...parts)
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((chunk) =>
      chunk
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean)
}

async function applyInitSql(): Promise<void> {
  const initSqlPath = resolvePrismaResource('prisma', 'init.sql')
  if (!existsSync(initSqlPath)) {
    throw new Error(`No se encontró prisma/init.sql en ${initSqlPath}`)
  }

  const prisma = getPrisma()
  const statements = splitSqlStatements(readFileSync(initSqlPath, 'utf8'))
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

async function databaseNeedsSchema(): Promise<boolean> {
  try {
    const prisma = getPrisma()
    await prisma.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1')
    return false
  } catch {
    return true
  }
}

export async function runMigrations(): Promise<void> {
  process.env.DATABASE_URL = getDatabaseUrl()

  const prismaCli = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations')
  const canUseCli = existsSync(prismaCli) && !app.isPackaged

  if (canUseCli) {
    const runPrisma = (args: string[]) =>
      execFileAsync(process.execPath, [prismaCli, ...args], {
        env: {
          ...process.env,
          DATABASE_URL: getDatabaseUrl(),
          ELECTRON_RUN_AS_NODE: '1'
        },
        cwd: process.cwd()
      })

    if (existsSync(migrationsDir)) {
      try {
        await runPrisma(['migrate', 'deploy'])
        return
      } catch (error) {
        console.warn('[db] migrate deploy failed, trying db push', error)
      }
    }

    try {
      await runPrisma(['db', 'push', '--skip-generate'])
      return
    } catch (error) {
      console.warn('[db] db push failed, falling back to init.sql', error)
    }
  }

  if (await databaseNeedsSchema()) {
    await applyInitSql()
  }
}
