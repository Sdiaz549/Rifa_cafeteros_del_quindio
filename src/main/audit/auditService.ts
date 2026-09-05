import { getPrisma } from '../db/client'
import type { SessionUser } from '../../shared/types'

export async function writeAuditLog(input: {
  userId?: string | null
  module: string
  action: string
  entity: string
  entityId?: string | null
  previousValue?: unknown
  newValue?: unknown
  origin?: string
  notes?: string
}): Promise<void> {
  const prisma = getPrisma()
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      module: input.module,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      previousValue: input.previousValue != null ? JSON.stringify(input.previousValue) : null,
      newValue: input.newValue != null ? JSON.stringify(input.newValue) : null,
      origin: input.origin ?? 'MANUAL',
      notes: input.notes
    }
  })
}

export async function auditFromSession(
  session: SessionUser | null,
  input: Omit<Parameters<typeof writeAuditLog>[0], 'userId'>
): Promise<void> {
  await writeAuditLog({ ...input, userId: session?.userId })
}
