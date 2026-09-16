import { getPrisma } from '../db/client'

export function buyerRepository() {
  const prisma = getPrisma()
  return {
    count: () => prisma.buyer.count()
  }
}
