import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult, ChartPoint, DashboardSnapshot } from '../../shared/types'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function resolvePeriod(input?: {
  period?: 'hoy' | 'semana' | 'mes' | 'anio' | 'rango'
  from?: string
  to?: string
}): { from: Date; to: Date } {
  const now = new Date()
  const period = input?.period ?? 'mes'
  if (period === 'rango' && input?.from) {
    const from = startOfDay(new Date(input.from))
    const to = input.to ? new Date(input.to) : now
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (period === 'hoy') {
    return { from: startOfDay(now), to: now }
  }
  if (period === 'semana') {
    const day = now.getDay() || 7
    const from = startOfDay(addDays(now, 1 - day))
    return { from, to: now }
  }
  if (period === 'anio') {
    return { from: new Date(now.getFullYear(), 0, 1), to: now }
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
}

export async function getAdminDashboard(input?: {
  period?: 'hoy' | 'semana' | 'mes' | 'anio' | 'rango'
  from?: string
  to?: string
}): Promise<ApiResult<DashboardSnapshot>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'dashboard:view')
    const prisma = getPrisma()

    const now = new Date()
    const startDay = startOfDay(now)
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const { from, to } = resolvePeriod(input)

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
      ingresosPeriodo,
      egresosTotal,
      egresosPeriodo,
      recaudado,
      porCobrar,
      total,
      disponible,
      enAbonos,
      cancelada,
      perdida,
      liquidadas,
      pendLiq,
      paymentsInPeriod,
      methods
    ] = await Promise.all([
      sumPayments({ status: 'ACTIVO', paidAt: { gte: startDay } }),
      sumPayments({ status: 'ACTIVO', paidAt: { gte: startMonth } }),
      sumPayments({ status: 'ACTIVO', paidAt: { gte: from, lte: to } }),
      sumExpenses({ status: 'ACTIVO' }),
      sumExpenses({ status: 'ACTIVO', expenseDate: { gte: from, lte: to } }),
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
      prisma.ticket.count({ where: { status: 'CANCELADA', isSettled: false } }),
      prisma.payment.findMany({
        where: { status: 'ACTIVO', paidAt: { gte: from, lte: to } },
        select: { amount: true, paidAt: true, paymentMethod: { select: { name: true } } }
      }),
      prisma.paymentMethod.findMany({ select: { name: true } })
    ])

    const dayMap = new Map<string, number>()
    const cursor = startOfDay(from)
    const last = startOfDay(to)
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10)
      dayMap.set(key, 0)
      cursor.setDate(cursor.getDate() + 1)
      if (dayMap.size > 60) break
    }
    const methodMap = new Map<string, number>()
    for (const m of methods) methodMap.set(m.name, 0)
    for (const p of paymentsInPeriod) {
      const key = p.paidAt.toISOString().slice(0, 10)
      dayMap.set(key, (dayMap.get(key) ?? 0) + p.amount)
      const name = p.paymentMethod.name
      methodMap.set(name, (methodMap.get(name) ?? 0) + p.amount)
    }

    const ingresosPorDia: ChartPoint[] = [...dayMap.entries()].map(([label, value]) => ({
      label: label.slice(8, 10) + '/' + label.slice(5, 7),
      value
    }))
    const metodosPago: ChartPoint[] = [...methodMap.entries()]
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }))
    const estadosBoletas: ChartPoint[] = [
      { label: 'Disponible', value: disponible },
      { label: 'En abonos', value: enAbonos },
      { label: 'Cancelada', value: cancelada },
      { label: 'Perdida', value: perdida }
    ]

    return {
      ok: true,
      data: {
        ingresosDia,
        ingresosMes,
        ingresosPeriodo,
        egresosTotal,
        egresosPeriodo,
        balance: recaudado - egresosTotal,
        recaudado,
        porCobrar: porCobrar._sum.balanceDue ?? 0,
        total,
        vendidas: total - disponible,
        disponible,
        enAbonos,
        cancelada,
        perdida,
        liquidadas,
        pendienteLiquidacion: pendLiq,
        periodFrom: from.toISOString(),
        periodTo: to.toISOString(),
        charts: { ingresosPorDia, estadosBoletas, metodosPago }
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error en dashboard' }
  }
}
