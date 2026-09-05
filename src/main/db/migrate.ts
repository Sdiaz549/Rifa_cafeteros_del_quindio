import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import { getDatabaseUrl } from '../paths'

const execFileAsync = promisify(execFile)

export async function runMigrations(): Promise<void> {
  process.env.DATABASE_URL = getDatabaseUrl()

  const prismaCli = join(
    process.cwd(),
    'node_modules',
    'prisma',
    'build',
    'index.js'
  )

  // In packaged apps migrations should already be applied; for dev use migrate deploy.
  if (!existsSync(prismaCli) && app.isPackaged) {
    return
  }

  try {
    await execFileAsync(
      process.execPath,
      [
        join(process.cwd(), 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy'
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: getDatabaseUrl(),
          ELECTRON_RUN_AS_NODE: '1'
        },
        cwd: process.cwd()
      }
    )
  } catch (error) {
    // Fallback: ensure schema via db push in early development
    console.warn('[db] migrate deploy failed, trying db push', error)
    await execFileAsync(
      process.execPath,
      [join(process.cwd(), 'node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'],
      {
        env: {
          ...process.env,
          DATABASE_URL: getDatabaseUrl(),
          ELECTRON_RUN_AS_NODE: '1'
        },
        cwd: process.cwd()
      }
    )
  }
}
