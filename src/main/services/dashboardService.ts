import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission, hasPermission } from '../../shared/permissions'
import { COMPANY_NAME, SETTING_KEYS } from '../../shared/constants'
import type { ApiResult, ChartPoint, DashboardSnapshot, HomeOverview } from '../../shared/types'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export async function getHomeOverview(): Promise<ApiResult<HomeOverview>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:view')
    const prisma = getPrisma()
    const canFinance = hasPermission(session.role, 'dashboard:view')

    const now = new Date()
    const startDay = startOfDay(now)
    const yesterdayStart = addDays(startDay, -1)
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const sevenStart = addDays(startDay, -6)

    const sumPayments = async (where: object) => {
      const agg = await prisma.payment.aggregate({ where, _sum: { amount: true } })
      return agg._sum.amount ?? 0
    }
    const sumExpenses = async (where: object) => {
      const agg = await prisma.expense.aggregate({ where, _sum: { amount: true } })
      return agg._sum.amount ?? 0
    }

    const [
      total,
      disponible,
      enAbonos,
      cancelada,
      perdida,
      liquidadas,
      companyName,
      raffleName,
      recentSalesRaw,
      recentPaymentsRaw,
      sellerGroups,
      weekPayments
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'DISPONIBLE' } }),
      prisma.ticket.count({ where: { status: 'EN_ABONOS' } }),
      prisma.ticket.count({ where: { status: 'CANCELADA' } }),
      prisma.ticket.count({ where: { status: 'PERDIDA' } }),
      prisma.ticket.count({ where: { isSettled: true } }),
      prisma.setting.findUnique({ where: { key: SETTING_KEYS.companyName } }),
      prisma.setting.findUnique({ where: { key: SETTING_KEYS.raffleName } }),
      prisma.sale.findMany({
        where: { status: 'ACTIVO' },
        orderBy: { soldAt: 'desc' },
        take: 6,
        include: {
          ticket: { select: { number: true, status: true } },
          buyer: { select: { fullName: true } },
          seller: { select: { fullName: true } }
        }
      }),
      prisma.payment.findMany({
        where: { status: 'ACTIVO', type: 'ABONO' },
        orderBy: { paidAt: 'desc' },
        take: 6,
        include: {
          paymentMethod: { select: { name: true } },
          ticket: { select: { number: true, buyer: { select: { fullName: true } } } }
        }
      }),
      prisma.ticket.groupBy({
        by: ['sellerId'],
        where: { sellerId: { not: null }, status: { not: 'DISPONIBLE' } },
        _count: { _all: true },
        orderBy: { _count: { sellerId: 'desc' } },
        take: 5
      }),
      prisma.payment.findMany({
        where: { status: 'ACTIVO', paidAt: { gte: sevenStart } },
        select: { amount: true, paidAt: true }
      })
    ])

    const sellerIds = sellerGroups.map((g) => g.sellerId).filter((id): id is string => Boolean(id))
    const sellers = sellerIds.length
      ? await prisma.seller.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, fullName: true }
        })
      : []
    const sellerNames = new Map(sellers.map((s) => [s.id, s.fullName]))

    const dayMap = new Map<string, number>()
    for (let i = 0; i < 7; i++) {
      const d = addDays(sevenStart, i)
      dayMap.set(localDateKey(d), 0)
    }
    for (const p of weekPayments) {
      const key = localDateKey(p.paidAt)
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + p.amount)
    }
    const ingresos7Dias: ChartPoint[] = [...dayMap.entries()].map(([iso, value]) => {
      const [y, m, d] = iso.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return {
        label: date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
        value
      }
    })

    let finance: HomeOverview['finance'] = null
    if (canFinance) {
      const [ingresosHoy, ingresosAyer, ingresosMes, ingresosMesAnt, egresosMes] = await Promise.all(
        [
          sumPayments({ status: 'ACTIVO', paidAt: { gte: startDay } }),
          sumPayments({
            status: 'ACTIVO',
            paidAt: { gte: yesterdayStart, lt: startDay }
          }),
          sumPayments({ status: 'ACTIVO', paidAt: { gte: startMonth } }),
          sumPayments({
            status: 'ACTIVO',
            paidAt: { gte: prevMonthStart, lt: startMonth }
          }),
          sumExpenses({ status: 'ACTIVO', expenseDate: { gte: startMonth } })
        ]
      )
      finance = {
        ingresosHoy,
        ingresosHoyDeltaPct: deltaPct(ingresosHoy, ingresosAyer),
        ingresosMes,
        ingresosMesDeltaPct: deltaPct(ingresosMes, ingresosMesAnt),
        egresosMes,
        balanceMes: ingresosMes - egresosMes
      }
    }

    return {
      ok: true,
      data: {
        raffleName: raffleName?.value ?? 'RIFA Cafeteros del Quindío',
        companyName: companyName?.value ?? COMPANY_NAME,
        finance,
        tickets: {
          total,
          vendidas: total - disponible,
          disponible,
          enAbonos,
          cancelada,
          perdida,
          liquidadas
        },
        charts: {
          ingresos7Dias,
          estadosBoletas: [
            { label: 'Sin vender', value: disponible },
            { label: 'En abonos', value: enAbonos },
            { label: 'Canceladas', value: cancelada },
            { label: 'Perdidas', value: perdida }
          ],
          topVendedores: sellerGroups.map((g) => ({
            label: (g.sellerId && sellerNames.get(g.sellerId)) || 'Sin vendedor',
            value: g._count._all
          }))
        },
        recentSales: recentSalesRaw.map((s) => ({
          id: s.id,
          soldAt: s.soldAt.toISOString(),
          ticketNumber: s.ticket.number,
          buyerName: s.buyer.fullName,
          sellerName: s.seller.fullName,
          amount: s.amount,
          status: s.ticket.status
        })),
        recentPayments: recentPaymentsRaw.map((p) => ({
          id: p.id,
          paidAt: p.paidAt.toISOString(),
          ticketNumber: p.ticket.number,
          buyerName: p.ticket.buyer?.fullName ?? '—',
          amount: p.amount,
          paymentMethodName: p.paymentMethod.name
        }))
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error en inicio' }
  }
}
