import { getPrisma } from '../db/client'

export function userRepository() {
  const prisma = getPrisma()
  return {
    findByUsername: (username: string) =>
      prisma.user.findUnique({ where: { username }, include: { role: true } }),
    findById: (id: string) => prisma.user.findUnique({ where: { id }, include: { role: true } }),
    count: () => prisma.user.count()
  }
}
