import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Localiza el query engine de Prisma fuera del asar.
 * En el instalador el cliente va en app.asar.unpacked.
 */
export function configurePrismaEngine(): void {
  const engine = resolveQueryEngine()
  if (engine) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine
  }
}

export function getPrismaSchemaPath(): string {
  const candidates = [
    join(process.resourcesPath, 'prisma', 'schema.prisma'),
    join(process.resourcesPath, 'app.asar.unpacked', 'prisma', 'schema.prisma'),
    join(process.cwd(), 'prisma', 'schema.prisma')
  ]
  return candidates.find((p) => existsSync(p)) ?? join(process.cwd(), 'prisma', 'schema.prisma')
}

export function getPrismaSqlDir(): string {
  const candidates = [
    join(process.resourcesPath, 'prisma', 'sql'),
    join(process.resourcesPath, 'app.asar.unpacked', 'prisma', 'sql'),
    join(process.cwd(), 'prisma', 'sql')
  ]
  return candidates.find((p) => existsSync(p)) ?? join(process.cwd(), 'prisma', 'sql')
}

function resolveQueryEngine(): string | null {
  const dirs: string[] = []
  try {
    if (app.isPackaged) {
      dirs.push(
        join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client'),
        join(process.resourcesPath, 'prisma-client'),
        join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@prisma', 'client')
      )
    }
  } catch {
    /* ignore */
  }
  dirs.push(
    join(process.cwd(), 'node_modules', '.prisma', 'client'),
    join(process.cwd(), 'node_modules', '@prisma', 'engines')
  )

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const match = readdirSync(dir).find(
      (name) => name.includes('query_engine') && (name.endsWith('.node') || name.endsWith('.dll'))
    )
    if (match) return join(dir, match)
  }
  return null
}
