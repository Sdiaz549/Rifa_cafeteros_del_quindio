import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { canSettle } from '../../shared/domain/ticketStatus'
import type {
  ApiResult,
  SettlementSummary,
  TicketSummary
} from '../../shared/types'

const settleSchema = z.object({
  ticketNumber: z.number().int().nonnegative(),
  settledAt: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().int().positive().optional()
})

function mapTicket(t: {
  id: string
  number: number
  status: TicketSummary['status']
  isSettled: boolean
  sellerId: string | null
  buyerId: string | null
  totalAmount: number
  totalPaid: number
  balanceDue: number
  soldAt: Date | null
  seller: { fullName: string } | null
  buyer: { fullName: string } | null
}): TicketSummary {
  return {
    id: t.id,
    number: t.number,
    status: t.status,
    isSettled: t.isSettled,
    sellerId: t.sellerId,
    sellerName: t.seller?.fullName ?? null,
    buyerId: t.buyerId,
    buyerName: t.buyer?.fullName ?? null,
    totalAmount: t.totalAmount,
    totalPaid: t.totalPaid,
    balanceDue: t.balanceDue,
    soldAt: t.soldAt?.toISOString() ?? null
  }
}

function mapSettlement(s: {
  id: string
  ticketId: string
  sellerId: string
  amount: number
  settledAt: Date
  userId: string
  notes: string | null
  status: SettlementSummary['status']
  ticket: { number: number }
  seller: { fullName: string }
  user: { fullName: string }
}): SettlementSummary {
  return {
    id: s.id,
    ticketId: s.ticketId,
    ticketNumber: s.ticket.number,
    sellerId: s.sellerId,
    sellerName: s.seller.fullName,
    amount: s.amount,
    settledAt: s.settledAt.toISOString(),
    userId: s.userId,
    userName: s.user.fullName,
    notes: s.notes,
    status: s.status
  }
}

export async function settleTicket(
  raw: unknown
): Promise<ApiResult<{ ticket: TicketSummary; settlement: SettlementSummary }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'settlements:manage')

    const parsed = settleSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: 'Datos de liquidación inválidos.' }
    }
    const input = parsed.data

    const prisma = getPrisma()
    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { number: input.ticketNumber },
        include: { seller: true, buyer: true }
      })
      if (!ticket) {
        throw new Error(`No existe la boleta ${input.ticketNumber}.`)
      }
      if (!canSettle(ticket.status, ticket.isSettled)) {
        if (ticket.isSettled) {
          throw new Error('La boleta ya está liquidada.')
        }
        throw new Error('Solo se pueden liquidar boletas canceladas (pagadas en su totalidad).')
      }
      if (!ticket.sellerId) {
        throw new Error('La boleta no tiene vendedor asignado para liquidar.')
      }

      const existing = await tx.settlement.findFirst({
        where: { ticketId: ticket.id, status: 'ACTIVO' }
      })
      if (existing) {
        throw new Error('La boleta ya tiene una liquidación activa.')
      }

      const amount = input.amount ?? ticket.totalPaid
      if (amount <= 0) {
        throw new Error('El valor de liquidación debe ser mayor que cero.')
      }

      const settledAt = input.settledAt ? new Date(input.settledAt) : new Date()

      const settlement = await tx.settlement.create({
        data: {
          ticketId: ticket.id,
          sellerId: ticket.sellerId,
          amount,
          settledAt,
          userId: session.userId,
          notes: input.notes || null,
          status: 'ACTIVO'
        },
        include: {
          ticket: true,
          seller: true,
          user: true
        }
      })

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          isSettled: true,
          settledAt
        },
        include: { seller: true, buyer: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'LIQUIDACIONES',
          action: 'LIQUIDACION_CREADA',
          entity: 'Settlement',
          entityId: settlement.id,
          newValue: JSON.stringify({
            ticketNumber: ticket.number,
            sellerId: ticket.sellerId,
            amount,
            settledAt: settledAt.toISOString()
          })
        }
      })

      return { ticket: updated, settlement }
    })

    return {
      ok: true,
      data: {
        ticket: mapTicket(result.ticket),
        settlement: mapSettlement(result.settlement)
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al liquidar la boleta'
    }
  }
}

export async function listPendingSettlements(input?: {
  sellerId?: string
  query?: string
  take?: number
}): Promise<ApiResult<{ items: TicketSummary[]; total: number; totalAmount: number }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'settlements:manage')
    const prisma = getPrisma()
    const take = input?.take ?? 200
    const q = input?.query?.trim()

    const where = {
      status: 'CANCELADA' as const,
      isSettled: false,
      ...(input?.sellerId ? { sellerId: input.sellerId } : {}),
      ...(q
        ? {
            OR: [
              ...(Number.isInteger(Number(q)) ? [{ number: Number(q) }] : []),
              { seller: { fullName: { contains: q } } },
              { buyer: { fullName: { contains: q } } },
              { buyer: { documentId: { contains: q } } }
            ]
          }
        : {})
    }

    const [items, total, agg] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: { seller: true, buyer: true },
        orderBy: { number: 'asc' },
        take
      }),
      prisma.ticket.count({ where }),
      prisma.ticket.aggregate({ where, _sum: { totalPaid: true } })
    ])

    return {
      ok: true,
      data: {
        items: items.map(mapTicket),
        total,
        totalAmount: agg._sum.totalPaid ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar pendientes de liquidación'
    }
  }
}

export async function listSettlements(input?: {
  sellerId?: string
  query?: string
  take?: number
}): Promise<ApiResult<{ items: SettlementSummary[]; total: number; totalAmount: number }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'settlements:manage')
    const prisma = getPrisma()
    const take = input?.take ?? 200
    const q = input?.query?.trim()

    const where = {
      status: 'ACTIVO' as const,
      ...(input?.sellerId ? { sellerId: input.sellerId } : {}),
      ...(q
        ? {
            OR: [
              ...(Number.isInteger(Number(q)) ? [{ ticket: { number: Number(q) } }] : []),
              { seller: { fullName: { contains: q } } },
              { notes: { contains: q } }
            ]
          }
        : {})
    }

    const [items, total, agg] = await Promise.all([
      prisma.settlement.findMany({
        where,
        include: { ticket: true, seller: true, user: true },
        orderBy: { settledAt: 'desc' },
        take
      }),
      prisma.settlement.count({ where }),
      prisma.settlement.aggregate({ where, _sum: { amount: true } })
    ])

    return {
      ok: true,
      data: {
        items: items.map(mapSettlement),
        total,
        totalAmount: agg._sum.amount ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar liquidaciones'
    }
  }
}
