import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, TicketSummary, UnsoldBySellerSummary } from '../../shared/types'

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

export async function listUnsoldBySeller(input?: {
  sellerId?: string
  query?: string
  onlyWithSeller?: boolean
}): Promise<
  ApiResult<{
    groups: UnsoldBySellerSummary[]
    totals: {
      unsoldCount: number
      ticketCount: number
      unsoldPercent: number
      withoutSellerCount: number
    }
  }>
> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'unsold:view')
    const prisma = getPrisma()
    const q = input?.query?.trim().toLowerCase()

    const [sellers, unsoldTickets, totalTickets, withoutSellerCount] = await Promise.all([
      prisma.seller.findMany({
        where: {
          ...(input?.sellerId ? { id: input.sellerId } : {}),
          ...(q ? { fullName: { contains: q } } : {})
        },
        orderBy: { fullName: 'asc' }
      }),
      prisma.ticket.findMany({
        where: {
          status: 'DISPONIBLE',
          ...(input?.sellerId
            ? { sellerId: input.sellerId }
            : input?.onlyWithSeller
              ? { sellerId: { not: null } }
              : {})
        },
        include: { seller: true, buyer: true },
        orderBy: { number: 'asc' }
      }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'DISPONIBLE', sellerId: null } })
    ])

    const assignedCounts = await prisma.ticket.groupBy({
      by: ['sellerId'],
      where: { sellerId: { not: null } },
      _count: { _all: true }
    })
    const assignedMap = new Map(
      assignedCounts.map((row) => [row.sellerId as string, row._count._all])
    )

    const unsoldBySeller = new Map<string | null, typeof unsoldTickets>()
    for (const ticket of unsoldTickets) {
      const key = ticket.sellerId
      const list = unsoldBySeller.get(key) ?? []
      list.push(ticket)
      unsoldBySeller.set(key, list)
    }

    const groups: UnsoldBySellerSummary[] = []

    for (const seller of sellers) {
      const tickets = unsoldBySeller.get(seller.id) ?? []
      if (tickets.length === 0 && !input?.sellerId) {
        continue
      }
      const ticketCount = assignedMap.get(seller.id) ?? 0
      const unsoldCount = tickets.length
      groups.push({
        sellerId: seller.id,
        sellerName: seller.fullName,
        sellerStatus: seller.status,
        ticketCount,
        unsoldCount,
        unsoldPercent: ticketCount > 0 ? Math.round((unsoldCount / ticketCount) * 1000) / 10 : 0,
        tickets: tickets.map(mapTicket)
      })
    }

    const showOrphans =
      !input?.sellerId &&
      !input?.onlyWithSeller &&
      (!q || 'sin vendedor'.includes(q) || q.includes('sin'))
    if (showOrphans) {
      const orphanTickets = unsoldBySeller.get(null) ?? []
      if (orphanTickets.length > 0) {
        groups.unshift({
          sellerId: null,
          sellerName: 'Sin vendedor asignado',
          sellerStatus: null,
          ticketCount: withoutSellerCount,
          unsoldCount: orphanTickets.length,
          unsoldPercent: 100,
          tickets: orphanTickets.map(mapTicket)
        })
      }
    }

    const unsoldCount = unsoldTickets.length

    return {
      ok: true,
      data: {
        groups,
        totals: {
          unsoldCount,
          ticketCount: totalTickets,
          unsoldPercent:
            totalTickets > 0 ? Math.round((unsoldCount / totalTickets) * 1000) / 10 : 0,
          withoutSellerCount
        }
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar boletas sin vender'
    }
  }
}
