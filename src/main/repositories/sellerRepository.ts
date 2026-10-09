import { getPrisma } from '../db/client'

export function sellerRepository() {
  const prisma = getPrisma()
  return {
    count: () => prisma.seller.count({ where: { deletedAt: null } }),
    countActive: () => prisma.seller.count({ where: { status: 'ACTIVO', deletedAt: null } })
  }
}
