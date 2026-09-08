import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, BuyerSummary } from '../../shared/types'

const buyerSchema = z.object({
  fullName: z.string().min(2),
  documentId: z.string().min(3),
  phone: z.string().min(5),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable()
})

function mapBuyer(b: {
  id: string
  fullName: string
  documentId: string
  phone: string
  address: string | null
  email: string | null
  notes: string | null
  _count?: { tickets: number }
  tickets?: { balanceDue: number }[]
}): BuyerSummary {
  return {
    id: b.id,
    fullName: b.fullName,
    documentId: b.documentId,
    phone: b.phone,
    address: b.address,
    email: b.email,
    notes: b.notes,
    ticketsCount: b._count?.tickets,
    balanceDue: b.tickets?.reduce((sum, t) => sum + t.balanceDue, 0)
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
    const buyers = await prisma.buyer.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { documentId: { contains: q } },
              { phone: { contains: q } }
            ]
          }
        : undefined,
      include: {
        _count: { select: { tickets: true } },
        tickets: { select: { balanceDue: true } }
      },
      orderBy: { fullName: 'asc' },
      take: input?.take ?? 100
    })
    return { ok: true, data: buyers.map(mapBuyer) }
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
            _count: { select: { tickets: true } },
            tickets: { select: { balanceDue: true } }
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
            _count: { select: { tickets: true } },
            tickets: { select: { balanceDue: true } }
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
