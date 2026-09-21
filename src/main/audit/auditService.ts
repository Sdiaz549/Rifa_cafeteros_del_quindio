import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, AuditListResult, AuditLogSummary, SessionUser } from '../../shared/types'

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
      notes: input.notes ?? null
    }
  })
}

export async function auditFromSession(
  session: SessionUser | null,
  input: Omit<Parameters<typeof writeAuditLog>[0], 'userId'>
): Promise<void> {
  await writeAuditLog({ ...input, userId: session?.userId })
}

function mapAuditLog(row: {
  id: string
  createdAt: Date
  userId: string | null
  module: string
  action: string
  entity: string
  entityId: string | null
  previousValue: string | null
  newValue: string | null
  origin: string
  notes: string | null
  user: { fullName: string } | null
}): AuditLogSummary {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    userName: row.user?.fullName ?? null,
    module: row.module,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    previousValue: row.previousValue,
    newValue: row.newValue,
    origin: row.origin,
    notes: row.notes
  }
}

export async function listAuditLogs(input?: {
  from?: string
  to?: string
  module?: string
  query?: string
  take?: number
}): Promise<ApiResult<AuditListResult>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'audit:view')
    const prisma = getPrisma()

    const from = input?.from ? new Date(input.from) : undefined
    const to = input?.to ? new Date(input.to) : undefined
    if (to) to.setHours(23, 59, 59, 999)
    const take = Math.min(input?.take ?? 200, 500)
    const q = input?.query?.trim()
    const moduleFilter = input?.module?.trim()

    const where = {
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q } },
              { entity: { contains: q } },
              { entityId: { contains: q } },
              { notes: { contains: q } },
              { user: { fullName: { contains: q } } }
            ]
          }
        : {})
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      ok: true,
      data: {
        items: rows.map(mapAuditLog),
        total
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar auditoría'
    }
  }
}

export async function listAuditModules(): Promise<ApiResult<string[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'audit:view')
    const rows = await getPrisma().auditLog.findMany({
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' }
    })
    return { ok: true, data: rows.map((r) => r.module) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar módulos'
    }
  }
}
