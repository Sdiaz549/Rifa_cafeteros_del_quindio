import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult } from '../../shared/types'

export async function getAdminDashboard(input?: {
  from?: string
  to?: string
}): Promise<ApiResult<Record<string, number>>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'dashboard:view')
    const prisma = getPrisma()

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const from = input?.from ? new Date(input.from) : undefined
    const to = input?.to ? new Date(input.to) : undefined

    const paidFilter = (start: Date, end?: Date) => ({
      status: 'ACTIVO' as const,
      paidAt: {
        gte: start,
        ...(end ? { lte: end } : {})
      }
    })

    const sumPayments = async (where: object) => {
      const agg = await prisma.payment.aggregate({
        where,
        _sum: { amount: true }
      })
      return agg._sum.amount ?? 0
    }

    const sumExpenses = async (where: object) => {
      const agg = await prisma.expense.aggregate({
        where,
        _sum: { amount: true }
      })
      return agg._sum.amount ?? 0
    }

    const [
      ingresosDia,
      ingresosMes,
      egresosTotal,
      recaudado,
      porCobrar,
      total,
      disponible,
      enAbonos,
      cancelada,
      perdida,
      liquidadas,
      pendLiq
    ] = await Promise.all([
      sumPayments(paidFilter(startOfDay)),
      sumPayments(paidFilter(startOfMonth)),
      sumExpenses({
        status: 'ACTIVO',
        ...(from || to
          ? { expenseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {})
      }),
      sumPayments({ status: 'ACTIVO' }),
      prisma.ticket.aggregate({
        where: { status: 'EN_ABONOS' },
        _sum: { balanceDue: true }
      }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'DISPONIBLE' } }),
      prisma.ticket.count({ where: { status: 'EN_ABONOS' } }),
      prisma.ticket.count({ where: { status: 'CANCELADA' } }),
      prisma.ticket.count({ where: { status: 'PERDIDA' } }),
      prisma.ticket.count({ where: { isSettled: true } }),
      prisma.ticket.count({ where: { status: 'CANCELADA', isSettled: false } })
    ])

    const balance = recaudado - egresosTotal

    return {
      ok: true,
      data: {
        ingresosDia,
        ingresosMes,
        egresosTotal,
        balance,
        recaudado,
        porCobrar: porCobrar._sum.balanceDue ?? 0,
        total,
        vendidas: total - disponible,
        disponible,
        enAbonos,
        cancelada,
        perdida,
        liquidadas,
        pendienteLiquidacion: pendLiq
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error en dashboard' }
  }
}
