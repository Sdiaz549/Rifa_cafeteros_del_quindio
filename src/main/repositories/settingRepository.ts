import { getPrisma } from '../db/client'

export function settingRepository() {
  const prisma = getPrisma()
  return {
    get: (key: string) => prisma.setting.findUnique({ where: { key } }),
    upsert: (key: string, value: string, userId?: string | null) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value, updatedByUserId: userId ?? null },
        update: { value, updatedByUserId: userId ?? null }
      })
  }
}
