import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import { getDatabaseUrl } from '../paths'

const execFileAsync = promisify(execFile)

export async function runMigrations(): Promise<void> {
  process.env.DATABASE_URL = getDatabaseUrl()

  const prismaCli = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations')

  if (!existsSync(prismaCli) && app.isPackaged) {
    return
  }

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

  await runPrisma(['db', 'push', '--skip-generate'])
}
