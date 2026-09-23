import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, SellerSummary, SellerTicketSummary, TicketStatus } from '../../shared/types'

const sellerSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, 'El nombre del vendedor es obligatorio.'),
  documentId: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  notes: z.string().optional().nullable()
})

type SellerStat = {
  ticketsCount: number
  availableCount: number
  partialCount: number
  paidCount: number
  lostCount: number
  settledCount: number
  collectedTotal: number
  pendingTotal: number
}

function emptySellerStat(): SellerStat {
  return {
    ticketsCount: 0,
    availableCount: 0,
    partialCount: 0,
    paidCount: 0,
    lostCount: 0,
    settledCount: 0,
    collectedTotal: 0,
    pendingTotal: 0
  }
}

async function loadSellerStats(prisma: PrismaClient, sellerIds: string[]): Promise<Map<string, SellerStat>> {
  const map = new Map(sellerIds.map((id) => [id, emptySellerStat()]))
  if (sellerIds.length === 0) return map

  const [grouped, settled] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['sellerId', 'status'],
      where: { sellerId: { in: sellerIds } },
      _count: { _all: true },
      _sum: { totalPaid: true, balanceDue: true }
    }),
    prisma.ticket.groupBy({
      by: ['sellerId'],
      where: { sellerId: { in: sellerIds }, isSettled: true },
      _count: { _all: true }
    })
  ])

  for (const row of grouped) {
    if (!row.sellerId) continue
    const c = map.get(row.sellerId) ?? emptySellerStat()
    c.ticketsCount += row._count._all
    c.collectedTotal += row._sum.totalPaid ?? 0
    c.pendingTotal += row._sum.balanceDue ?? 0
    if (row.status === 'SIN_VENDER') c.availableCount += row._count._all
    else if (row.status === 'EN_ABONOS') c.partialCount += row._count._all
    else if (row.status === 'CANCELADA') c.paidCount += row._count._all
    else if (row.status === 'PERDIDA') c.lostCount += row._count._all
    map.set(row.sellerId, c)
  }
  for (const row of settled) {
    if (!row.sellerId) continue
    const c = map.get(row.sellerId)
    if (c) c.settledCount = row._count._all
  }
  return map
}

function mapSeller(s: {
  id: string
  fullName: string
  documentId: string
  phone: string
  address: string | null
  status: 'ACTIVO' | 'INACTIVO'
  notes: string | null
  tickets?: {
    number?: number
    status: string
    isSettled: boolean
    totalPaid: number
    balanceDue: number
    buyer?: { fullName: string } | null
  }[]
} & Partial<SellerStat>): SellerSummary {
  const tickets = s.tickets
  const ticketSummaries: SellerTicketSummary[] | undefined = tickets
    ?.map((t) => ({
      number: Number(t.number),
      status: t.status as TicketStatus,
      isSettled: Boolean(t.isSettled),
      totalPaid: Number(t.totalPaid) || 0,
      balanceDue: Number(t.balanceDue) || 0,
      buyerName: t.buyer?.fullName ?? null
    }))
    .filter((t) => Number.isFinite(t.number) && t.number >= 0)
    .sort((a, b) => a.number - b.number)
  const fromTickets = ticketSummaries
    ? {
        ticketsCount: ticketSummaries.length,
        availableCount: ticketSummaries.filter((t) => t.status === 'SIN_VENDER').length,
        partialCount: ticketSummaries.filter((t) => t.status === 'EN_ABONOS').length,
        paidCount: ticketSummaries.filter((t) => t.status === 'CANCELADA').length,
        lostCount: ticketSummaries.filter((t) => t.status === 'PERDIDA').length,
        settledCount: ticketSummaries.filter((t) => t.isSettled).length,
        collectedTotal: ticketSummaries.reduce((sum, t) => sum + t.totalPaid, 0),
        pendingTotal: ticketSummaries.reduce((sum, t) => sum + t.balanceDue, 0),
        ticketNumbers: ticketSummaries.map((t) => t.number),
        tickets: ticketSummaries
      }
    : {
        ticketsCount: s.ticketsCount ?? 0,
        availableCount: s.availableCount ?? 0,
        partialCount: s.partialCount ?? 0,
        paidCount: s.paidCount ?? 0,
        lostCount: s.lostCount ?? 0,
        settledCount: s.settledCount ?? 0,
        collectedTotal: s.collectedTotal ?? 0,
        pendingTotal: s.pendingTotal ?? 0
      }

  return {
    id: s.id,
    fullName: s.fullName,
    documentId: s.documentId,
    phone: s.phone,
    address: s.address,
    status: s.status,
    notes: s.notes,
    ...fromTickets
  }
}

export async function listSellers(input?: {
  query?: string
  onlyActive?: boolean
  take?: number
}): Promise<ApiResult<SellerSummary[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'sellers:manage')
    const prisma = getPrisma()
    const q = input?.query?.trim()
    const sellers = await prisma.seller.findMany({
        where: {
          ...(input?.onlyActive ? { status: 'ACTIVO' } : {}),
          ...(q
            ? {
                OR: [
                  { fullName: { contains: q } },
                  { documentId: { contains: q } },
                  { phone: { contains: q } }
                ]
              }
            : {})
        },
        orderBy: { fullName: 'asc' },
        take: input?.take ?? 100
      })
    const stats = await loadSellerStats(prisma, sellers.map((s) => s.id))
    return {
      ok: true,
      data: sellers.map((seller) => mapSeller({ ...seller, ...stats.get(seller.id) }))
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al listar vendedores' }
  }
}

export async function upsertSeller(raw: unknown): Promise<ApiResult<SellerSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'sellers:manage')
    const parsed = sellerSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos de vendedor inválidos.' }
    }
    const data = parsed.data
    const prisma = getPrisma()
    const documentId = data.documentId?.trim() || ''
    const phone = data.phone?.trim() || ''
    const existing = data.id
      ? await prisma.seller.findUnique({ where: { id: data.id } })
      : documentId
        ? await prisma.seller.findUnique({ where: { documentId } })
        : null
    const seller = existing
      ? await prisma.seller.update({
          where: { id: existing.id },
          data: {
            fullName: data.fullName,
            ...(documentId ? { documentId } : {}),
            phone,
            address: data.address || null,
            status: data.status ?? existing.status,
            notes: data.notes || null
          },
          include: {
            tickets: {
              select: {
                number: true,
                status: true,
                isSettled: true,
                totalPaid: true,
                balanceDue: true,
                buyer: { select: { fullName: true } }
              },
              orderBy: { number: 'asc' }
            }
          }
        })
      : await prisma.seller.create({
          data: {
            fullName: data.fullName,
            documentId: documentId || `SC-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            phone,
            address: data.address || null,
            status: data.status ?? 'ACTIVO',
            notes: data.notes || null
          },
          include: {
            tickets: {
              select: {
                number: true,
                status: true,
                isSettled: true,
                totalPaid: true,
                balanceDue: true,
                buyer: { select: { fullName: true } }
              },
              orderBy: { number: 'asc' }
            }
          }
        })

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        module: 'VENDEDORES',
        action: existing ? 'VENDEDOR_ACTUALIZADO' : 'VENDEDOR_CREADO',
        entity: 'Seller',
        entityId: seller.id,
        newValue: JSON.stringify({ documentId: seller.documentId, fullName: seller.fullName }),
        origin: 'MANUAL'
      }
    })

    return { ok: true, data: mapSeller(seller) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al guardar vendedor' }
  }
}

export async function getSellerById(id: string): Promise<ApiResult<SellerSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'sellers:manage')
    const prisma = getPrisma()
    const seller = await prisma.seller.findUnique({ where: { id } })
    if (!seller) {
      return { ok: false, error: 'Vendedor no encontrado.' }
    }
    const tickets = await prisma.ticket.findMany({
      where: { sellerId: id },
      select: {
        number: true,
        status: true,
        isSettled: true,
        totalPaid: true,
        balanceDue: true,
        buyer: { select: { fullName: true } }
      },
      orderBy: { number: 'asc' }
    })
    return { ok: true, data: mapSeller({ ...seller, tickets }) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al consultar vendedor' }
  }
}
