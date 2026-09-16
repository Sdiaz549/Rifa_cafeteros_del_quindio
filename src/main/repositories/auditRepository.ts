import { getPrisma } from '../db/client'

export function auditRepository() {
  const prisma = getPrisma()
  return {
    create: (data: {
      userId?: string | null
      module: string
      action: string
      entity: string
      entityId?: string | null
      previousValue?: string | null
      newValue?: string | null
      origin?: string
      notes?: string | null
    }) =>
      prisma.auditLog.create({
        data: {
          userId: data.userId ?? null,
          module: data.module,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId ?? null,
          previousValue: data.previousValue ?? null,
          newValue: data.newValue ?? null,
          origin: data.origin ?? 'MANUAL',
          notes: data.notes ?? null
        }
      })
  }
}
