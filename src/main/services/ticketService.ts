import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, TicketSummary } from '../../shared/types'
import { ticketStatusLabel } from '../../shared/domain/ticketStatus'
import type { TicketStatus } from '../../shared/types'

function mapTicket(t: {
  id: string
  number: number
  status: TicketStatus
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

export async function listTickets(input?: {
  query?: string
  status?: TicketStatus
  take?: number
  skip?: number
}): Promise<ApiResult<{ items: TicketSummary[]; total: number }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:view')
    const prisma = getPrisma()
    const take = input?.take ?? 100
    const skip = input?.skip ?? 0
    const q = input?.query?.trim()

    const where: Record<string, unknown> = {}
    if (input?.status) where.status = input.status
    if (q) {
      const asNumber = Number(q)
      where.OR = [
        ...(!Number.isNaN(asNumber) ? [{ number: asNumber }] : []),
        { buyer: { fullName: { contains: q } } },
        { buyer: { documentId: { contains: q } } },
        { buyer: { phone: { contains: q } } },
        { seller: { fullName: { contains: q } } }
      ]
    }

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: { seller: true, buyer: true },
        orderBy: { number: 'asc' },
        take,
        skip
      }),
      prisma.ticket.count({ where })
    ])

    return {
      ok: true,
      data: {
        items: items.map((t) => mapTicket(t as never)),
        total
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al listar boletas' }
  }
}

export async function getTicketByNumber(
  number: number
): Promise<ApiResult<TicketSummary & { statusLabel: string }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:view')
    const prisma = getPrisma()
    const ticket = await prisma.ticket.findUnique({
      where: { number },
      include: { seller: true, buyer: true }
    })
    if (!ticket) {
      return { ok: false, error: `No existe la boleta ${number}.` }
    }
    const mapped = mapTicket(ticket as never)
    return {
      ok: true,
      data: { ...mapped, statusLabel: ticketStatusLabel(mapped.status) }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al consultar boleta' }
  }
}

export async function markTicketLost(number: number): Promise<ApiResult<TicketSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:mark_lost')
    const prisma = getPrisma()

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { number },
        include: { seller: true, buyer: true }
      })
      if (!ticket) {
        throw new Error(`No existe la boleta ${number}.`)
      }
      if (ticket.status === 'PERDIDA') {
        throw new Error(`La boleta ${number} ya está marcada como perdida.`)
      }
      if (ticket.status === 'DISPONIBLE') {
        throw new Error('No se puede marcar como perdida una boleta sin vender.')
      }

      const result = await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: 'PERDIDA' },
        include: { seller: true, buyer: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'BOLETAS',
          action: 'BOLETA_MARCADA_PERDIDA',
          entity: 'Ticket',
          entityId: ticket.id,
          previousValue: JSON.stringify({ status: ticket.status }),
          newValue: JSON.stringify({ status: 'PERDIDA' }),
          origin: 'MANUAL'
        }
      })

      return result
    })

    return { ok: true, data: mapTicket(updated as never) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al marcar boleta como perdida'
    }
  }
}

export async function getTicketStats(): Promise<
  ApiResult<Record<string, number>>
> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:view')
    const prisma = getPrisma()
    const [total, disponible, enAbonos, cancelada, perdida, liquidadas, pendLiq] =
      await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: 'DISPONIBLE' } }),
        prisma.ticket.count({ where: { status: 'EN_ABONOS' } }),
        prisma.ticket.count({ where: { status: 'CANCELADA' } }),
        prisma.ticket.count({ where: { status: 'PERDIDA' } }),
        prisma.ticket.count({ where: { isSettled: true } }),
        prisma.ticket.count({ where: { status: 'CANCELADA', isSettled: false } })
      ])

    return {
      ok: true,
      data: {
        total,
        disponible,
        enAbonos,
        cancelada,
        perdida,
        liquidadas,
        pendienteLiquidacion: pendLiq,
        vendidas: total - disponible
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al obtener estadísticas' }
  }
}
