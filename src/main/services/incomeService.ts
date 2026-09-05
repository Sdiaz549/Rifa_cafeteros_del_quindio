import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, IncomeListResult, IncomeSummary } from '../../shared/types'

function mapIncome(p: {
  id: string
  type: IncomeSummary['type']
  amount: number
  paidAt: Date
  origin: IncomeSummary['origin']
  notes: string | null
  paymentMethod: { name: string }
  user: { fullName: string }
  ticket: {
    number: number
    seller: { fullName: string } | null
    buyer: { fullName: string } | null
  }
}): IncomeSummary {
  return {
    id: p.id,
    ticketNumber: p.ticket.number,
    type: p.type,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    paymentMethodName: p.paymentMethod.name,
    sellerName: p.ticket.seller?.fullName ?? null,
    buyerName: p.ticket.buyer?.fullName ?? null,
    userName: p.user.fullName,
    origin: p.origin,
    notes: p.notes
  }
}

export async function listIncomes(input?: {
  from?: string
  to?: string
  type?: 'VENTA_INICIAL' | 'ABONO' | 'TODOS'
  query?: string
  take?: number
}): Promise<ApiResult<IncomeListResult>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'incomes:view')
    const prisma = getPrisma()

    const from = input?.from ? new Date(input.from) : undefined
    const to = input?.to ? new Date(input.to) : undefined
    const take = input?.take ?? 300
    const q = input?.query?.trim()
    const typeFilter =
      input?.type && input.type !== 'TODOS' ? { type: input.type } : {}

    const where = {
      status: 'ACTIVO' as const,
      ...typeFilter,
      ...(from || to
        ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(q
        ? {
            OR: [
              ...(Number.isInteger(Number(q)) ? [{ ticket: { number: Number(q) } }] : []),
              { ticket: { seller: { fullName: { contains: q } } } },
              { ticket: { buyer: { fullName: { contains: q } } } },
              { paymentMethod: { name: { contains: q } } },
              { notes: { contains: q } }
            ]
          }
        : {})
    }

    const [items, total, agg, initialAgg, installmentAgg] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          paymentMethod: true,
          user: true,
          ticket: { include: { seller: true, buyer: true } }
        },
        orderBy: { paidAt: 'desc' },
        take
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ where, _sum: { amount: true } }),
      prisma.payment.aggregate({
        where: { ...where, type: 'VENTA_INICIAL' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { ...where, type: 'ABONO' },
        _sum: { amount: true }
      })
    ])

    return {
      ok: true,
      data: {
        items: items.map(mapIncome),
        total,
        totalAmount: agg._sum.amount ?? 0,
        totalInitialSales: initialAgg._sum.amount ?? 0,
        totalInstallments: installmentAgg._sum.amount ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar ingresos'
    }
  }
}
