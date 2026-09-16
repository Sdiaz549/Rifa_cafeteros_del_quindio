import { PrismaClient } from '@prisma/client'
import { getDatabaseUrl } from '../paths'
import { logInfo } from '../logging/appLogger'

let prisma: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const url = getDatabaseUrl()
    process.env.DATABASE_URL = url
    prisma = new PrismaClient({
      datasources: {
        db: { url }
      }
    })
    logInfo('prisma.client.created', { url: url.replace(/.*\//, 'file:…/') })
  }
  return prisma
}

/** WAL + cache in-memory so listados de 10.000 boletas no bloqueen la UI. */
export async function configureSqlite(): Promise<void> {
  const db = getPrisma()
  await db.$queryRawUnsafe('PRAGMA journal_mode=WAL')
  await db.$executeRawUnsafe('PRAGMA synchronous=NORMAL')
  await db.$executeRawUnsafe('PRAGMA cache_size=-65536')
  await db.$executeRawUnsafe('PRAGMA temp_store=MEMORY')
  await db.$executeRawUnsafe('PRAGMA mmap_size=268435456')
  await db.$executeRawUnsafe('PRAGMA busy_timeout=5000')
  await db.$executeRawUnsafe('PRAGMA foreign_keys=ON')
  logInfo('sqlite.pragmas.ok', { journal: 'WAL', cacheMb: 64 })
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
    logInfo('prisma.client.disconnected')
  }
}

export function resetPrismaClient(): void {
  prisma = null
}
