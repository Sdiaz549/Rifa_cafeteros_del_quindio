import { PrismaClient } from './prismaImport'
import { getDatabaseUrl } from '../paths'

let prisma: InstanceType<typeof PrismaClient> | null = null

export function getPrisma(): InstanceType<typeof PrismaClient> {
  if (!prisma) {
    process.env.DATABASE_URL = getDatabaseUrl()
    prisma = new PrismaClient({
      datasources: {
        db: { url: getDatabaseUrl() }
      }
    })
  }
  return prisma
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
