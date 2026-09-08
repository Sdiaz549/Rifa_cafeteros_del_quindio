import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, SellerSummary } from '../../shared/types'

const sellerSchema = z.object({
  fullName: z.string().min(2),
  documentId: z.string().min(3),
  phone: z.string().min(5),
  address: z.string().optional().nullable(),
  status: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  notes: z.string().optional().nullable()
})

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
  }[]
}): SellerSummary {
  const tickets = s.tickets ?? []
  return {
    id: s.id,
    fullName: s.fullName,
    documentId: s.documentId,
    phone: s.phone,
    address: s.address,
    status: s.status,
    notes: s.notes,
    ticketsCount: tickets.length,
    availableCount: tickets.filter((t) => t.status === 'DISPONIBLE').length,
    partialCount: tickets.filter((t) => t.status === 'EN_ABONOS').length,
    paidCount: tickets.filter((t) => t.status === 'CANCELADA').length,
    lostCount: tickets.filter((t) => t.status === 'PERDIDA').length,
    settledCount: tickets.filter((t) => t.isSettled).length,
    collectedTotal: tickets.reduce((sum, t) => sum + t.totalPaid, 0),
    pendingTotal: tickets.reduce((sum, t) => sum + t.balanceDue, 0),
    ticketNumbers: tickets
      .map((t) => t.number)
      .filter((n): n is number => typeof n === 'number')
      .sort((a, b) => a - b)
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
      include: {
        tickets: {
          select: { number: true, status: true, isSettled: true, totalPaid: true, balanceDue: true }
        }
      },
      orderBy: { fullName: 'asc' },
      take: input?.take ?? 100
    })
    return { ok: true, data: sellers.map(mapSeller) }
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
      return { ok: false, error: 'Datos de vendedor inválidos.' }
    }
    const data = parsed.data
    const prisma = getPrisma()
    const existing = await prisma.seller.findUnique({ where: { documentId: data.documentId } })
    const seller = existing
      ? await prisma.seller.update({
          where: { id: existing.id },
          data: {
            fullName: data.fullName,
            phone: data.phone,
            address: data.address || null,
            status: data.status ?? existing.status,
            notes: data.notes || null
          },
          include: {
            tickets: {
              select: { number: true, status: true, isSettled: true, totalPaid: true, balanceDue: true }
            }
          }
        })
      : await prisma.seller.create({
          data: {
            fullName: data.fullName,
            documentId: data.documentId,
            phone: data.phone,
            address: data.address || null,
            status: data.status ?? 'ACTIVO',
            notes: data.notes || null
          },
          include: {
            tickets: {
              select: { number: true, status: true, isSettled: true, totalPaid: true, balanceDue: true }
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
    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        tickets: {
          select: { number: true, status: true, isSettled: true, totalPaid: true, balanceDue: true }
        }
      }
    })
    if (!seller) {
      return { ok: false, error: 'Vendedor no encontrado.' }
    }
    return { ok: true, data: mapSeller(seller) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al consultar vendedor' }
  }
}
