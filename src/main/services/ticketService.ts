import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, TicketSummary } from '../../shared/types'
import { ticketStatusLabel, canAssign } from '../../shared/domain/ticketStatus'
import type { TicketStatus } from '../../shared/types'
import { DEFAULT_TICKET_COUNT, SETTING_KEYS } from '../../shared/constants'
import { ticketNumberBounds } from '../../shared/tickets/numbers'
import { z } from 'zod'

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
    const take = Math.min(Math.max(input?.take ?? 200, 1), 500)
    const skip = Math.max(input?.skip ?? 0, 0)
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
        select: {
          id: true,
          number: true,
          status: true,
          isSettled: true,
          sellerId: true,
          buyerId: true,
          totalAmount: true,
          totalPaid: true,
          balanceDue: true,
          soldAt: true,
          seller: { select: { fullName: true } },
          buyer: { select: { fullName: true } }
        },
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

const assignSchema = z.object({
  ticketNumber: z.number().int().nonnegative(),
  sellerId: z.string().min(1).optional(),
  seller: z
    .object({
      fullName: z.string().min(2),
      documentId: z.string().min(3),
      phone: z.string().min(5),
      address: z.string().optional()
    })
    .optional()
})

export async function assignTicketToSeller(raw: unknown): Promise<ApiResult<TicketSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:sell')

    const parsed = assignSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: 'Datos de asignación inválidos.' }
    }
    const input = parsed.data
    if (!input.sellerId && !input.seller) {
      return { ok: false, error: 'Seleccione un vendedor o ingrese los datos de uno nuevo.' }
    }

    const prisma = getPrisma()
    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { number: input.ticketNumber },
        include: { seller: true, buyer: true }
      })
      if (!ticket) {
        throw new Error(`No existe la boleta ${input.ticketNumber}.`)
      }
      if (!canAssign(ticket.status)) {
        throw new Error('Solo se pueden asignar boletas disponibles. Esta boleta ya fue vendida.')
      }

      let sellerId = input.sellerId
      if (input.seller) {
        const existing = await tx.seller.findUnique({
          where: { documentId: input.seller.documentId }
        })
        if (existing) {
          const seller = await tx.seller.update({
            where: { id: existing.id },
            data: {
              fullName: input.seller.fullName,
              phone: input.seller.phone,
              address: input.seller.address || existing.address,
              status: 'ACTIVO'
            }
          })
          sellerId = seller.id
        } else {
          const created = await tx.seller.create({
            data: {
              fullName: input.seller.fullName,
              documentId: input.seller.documentId,
              phone: input.seller.phone,
              address: input.seller.address || null,
              status: 'ACTIVO'
            }
          })
          sellerId = created.id
        }
      }

      if (!sellerId) {
        throw new Error('No se pudo determinar el vendedor.')
      }

      const seller = await tx.seller.findUnique({ where: { id: sellerId } })
      if (!seller || seller.status !== 'ACTIVO') {
        throw new Error('El vendedor no existe o está inactivo.')
      }

      if (ticket.sellerId === seller.id) {
        return ticket
      }

      await tx.ticketAssignment.updateMany({
        where: { ticketId: ticket.id, endedAt: null },
        data: { endedAt: new Date() }
      })

      await tx.ticketAssignment.create({
        data: {
          ticketId: ticket.id,
          sellerId: seller.id,
          assignedByUserId: session.userId,
          reason: ticket.sellerId ? 'CAMBIO_VENDEDOR' : 'ASIGNACION_INICIAL'
        }
      })

      const ticketUpdated = await tx.ticket.update({
        where: { id: ticket.id },
        data: { sellerId: seller.id },
        include: { seller: true, buyer: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'BOLETAS',
          action: 'BOLETA_ASIGNADA',
          entity: 'Ticket',
          entityId: ticket.id,
          previousValue: JSON.stringify({ sellerId: ticket.sellerId }),
          newValue: JSON.stringify({
            ticketNumber: ticket.number,
            sellerId: seller.id,
            sellerName: seller.fullName
          }),
          origin: 'MANUAL'
        }
      })

      return ticketUpdated
    })

    return { ok: true, data: mapTicket(updated as never) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al asignar la boleta' }
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

export async function ensureTicketRange(): Promise<number> {
  const prisma = getPrisma()
  const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.ticketCount } })
  const count = Number(setting?.value) || DEFAULT_TICKET_COUNT
  const { first, last } = ticketNumberBounds(count)
  const expected = last - first + 1
  const existingCount = await prisma.ticket.count({
    where: { number: { gte: first, lte: last } }
  })
  if (existingCount >= expected) return 0

  const existing = await prisma.ticket.findMany({
    where: { number: { gte: first, lte: last } },
    select: { number: true }
  })
  const have = new Set(existing.map((t) => t.number))
  const missing: { number: number }[] = []
  for (let n = first; n <= last; n++) {
    if (!have.has(n)) missing.push({ number: n })
  }
  const chunk = 500
  for (let i = 0; i < missing.length; i += chunk) {
    await prisma.ticket.createMany({ data: missing.slice(i, i + chunk) })
  }
  if (missing.length) {
    console.log(`[tickets] generated ${missing.length} missing numbers (${String(first).padStart(4, '0')}–${String(last).padStart(4, '0')})`)
  }
  return missing.length
}
