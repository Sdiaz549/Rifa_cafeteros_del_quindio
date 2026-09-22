import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, BuyerSummary, BuyerTicketSummary } from '../../shared/types'

const buyerSchema = z.object({
  fullName: z.string().min(2),
  documentId: z.string().min(3),
  phone: z.string().min(5),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable()
})

function mapTickets(
  tickets: Array<{
    number: number
    status: BuyerTicketSummary['status']
    totalPaid: number
    balanceDue: number
    payments: Array<{
      id: string
      amount: number
      paidAt: Date
      type: string
      notes: string | null
      paymentMethod: { name: string }
    }>
  }>
): BuyerTicketSummary[] {
  return tickets.map((t) => ({
    number: t.number,
    status: t.status,
    totalPaid: t.totalPaid,
    balanceDue: t.balanceDue,
    payments: t.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      type: p.type,
      paymentMethodName: p.paymentMethod.name,
      notes: p.notes
    }))
  }))
}

function mapBuyer(b: {
  id: string
  fullName: string
  documentId: string
  phone: string
  address: string | null
  email: string | null
  notes: string | null
  _count?: { tickets: number }
  tickets?: Array<{
    number: number
    status: BuyerTicketSummary['status']
    totalPaid: number
    balanceDue: number
    payments: Array<{
      id: string
      amount: number
      paidAt: Date
      type: string
      notes: string | null
      paymentMethod: { name: string }
    }>
  }>
}): BuyerSummary {
  const tickets = b.tickets ? mapTickets(b.tickets) : undefined
  return {
    id: b.id,
    fullName: b.fullName,
    documentId: b.documentId,
    phone: b.phone,
    address: b.address,
    email: b.email,
    notes: b.notes,
    ticketsCount: b._count?.tickets ?? tickets?.length,
    ticketNumbers: tickets?.map((t) => t.number),
    balanceDue: tickets?.reduce((sum, t) => sum + t.balanceDue, 0),
    totalPaid: tickets?.reduce((sum, t) => sum + t.totalPaid, 0),
    tickets
  }
}

export async function listBuyers(input?: {
  query?: string
  take?: number
}): Promise<ApiResult<BuyerSummary[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'buyers:manage')
    const prisma = getPrisma()
    const q = input?.query?.trim()
    const ticketNumber = q && Number.isInteger(Number(q)) ? Number(q) : null
    const buyers = await prisma.buyer.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { documentId: { contains: q } },
              { phone: { contains: q } },
              ...(ticketNumber != null ? [{ tickets: { some: { number: ticketNumber } } }] : [])
            ]
          }
        : undefined,
      include: {
        _count: { select: { tickets: true } },
        tickets: {
          orderBy: { number: 'asc' },
          select: {
            number: true,
            status: true,
            totalPaid: true,
            balanceDue: true,
            payments: {
              where: { status: 'ACTIVO' },
              orderBy: { sequence: 'asc' },
              select: {
                id: true,
                amount: true,
                paidAt: true,
                type: true,
                notes: true,
                paymentMethod: { select: { name: true } }
              }
            }
          }
        }
      },
      orderBy: { fullName: 'asc' },
      take: input?.take ?? 200
    })
    return {
      ok: true,
      data: buyers.map((b) => mapBuyer(b))
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al listar compradores' }
  }
}

export async function upsertBuyer(raw: unknown): Promise<ApiResult<BuyerSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'buyers:manage')
    const parsed = buyerSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: 'Datos de comprador inválidos.' }
    }
    const data = parsed.data
    const prisma = getPrisma()
    const existing = await prisma.buyer.findUnique({ where: { documentId: data.documentId } })
    const buyer = existing
      ? await prisma.buyer.update({
          where: { id: existing.id },
          data: {
            fullName: data.fullName,
            phone: data.phone,
            address: data.address || null,
            email: data.email || null,
            notes: data.notes || null
          },
          include: {
            _count: { select: { tickets: true } }
          }
        })
      : await prisma.buyer.create({
          data: {
            fullName: data.fullName,
            documentId: data.documentId,
            phone: data.phone,
            address: data.address || null,
            email: data.email || null,
            notes: data.notes || null
          },
          include: {
            _count: { select: { tickets: true } }
          }
        })

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        module: 'COMPRADORES',
        action: existing ? 'COMPRADOR_ACTUALIZADO' : 'COMPRADOR_CREADO',
        entity: 'Buyer',
        entityId: buyer.id,
        newValue: JSON.stringify({ documentId: buyer.documentId, fullName: buyer.fullName }),
        origin: 'MANUAL'
      }
    })

    return { ok: true, data: mapBuyer(buyer) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al guardar comprador' }
  }
}
