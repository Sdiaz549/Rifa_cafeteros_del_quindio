import { getPrisma } from './client'
import { applySqlMigrations } from './sqlMigrator'
import { logInfo, logWarn } from '../logging/appLogger'

export async function runMigrations(): Promise<void> {
  const prisma = getPrisma()
  const result = await applySqlMigrations(prisma)
  logInfo('db.migrate.done', result)
  await migrateLegacyTicketStatus()
}

export async function migrateLegacyTicketStatus(): Promise<void> {
  try {
    const prisma = getPrisma()
    await prisma.$executeRawUnsafe(
      `UPDATE "Ticket" SET status = 'SIN_VENDER' WHERE status = 'DISPONIBLE'`
    )
  } catch (error) {
    logWarn('db.ticketStatus.migrationSkipped', error)
  }
}
