import { getPrisma } from '../db/client'

export function sellerRepository() {
  const prisma = getPrisma()
  return {
    count: () => prisma.seller.count(),
    countActive: () => prisma.seller.count({ where: { status: 'ACTIVO' } })
  }
}
