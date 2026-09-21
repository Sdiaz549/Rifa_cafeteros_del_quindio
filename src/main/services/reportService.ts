import { format } from 'date-fns'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission, hasPermission, type RoleCode } from '../../shared/permissions'
import type { ApiResult, ReportKind, ReportResult } from '../../shared/types'

const REPORT_TITLES: Record<ReportKind, string> = {
  ingresos_por_dia: 'Ingresos por día',
  ventas_por_vendedor: 'Ventas por vendedor',
  recaudo_por_vendedor: 'Recaudo por vendedor',
  metodos_de_pago: 'Métodos de pago',
  boletas_por_estado: 'Boletas por estado',
  egresos_por_categoria: 'Egresos por categoría',
  pendientes_liquidacion: 'Pendientes de liquidación'
}

const FINANCIAL_KINDS: ReportKind[] = ['ingresos_por_dia', 'egresos_por_categoria']

export function listReportKinds(role: RoleCode): Array<{ kind: ReportKind; title: string }> {
  const kinds: ReportKind[] = [
    'ventas_por_vendedor',
    'recaudo_por_vendedor',
    'metodos_de_pago',
    'boletas_por_estado',
    'pendientes_liquidacion'
  ]
  if (hasPermission(role, 'reports:financial')) {
    kinds.unshift(...FINANCIAL_KINDS)
  } else if (!hasPermission(role, 'reports:operational')) {
    return []
  }
  return kinds.map((kind) => ({ kind, title: REPORT_TITLES[kind] }))
}

export async function runReport(input: {
  kind: ReportKind
  from?: string
  to?: string
}): Promise<ApiResult<ReportResult>> {
  try {
    const session = requireSession()
    const kind = input.kind
    if (!REPORT_TITLES[kind]) {
      return { ok: false, error: 'Tipo de reporte no válido.' }
    }

    if (FINANCIAL_KINDS.includes(kind)) {
      assertPermission(session.role, 'reports:financial')
    } else {
      assertPermission(session.role, 'reports:operational')
    }

    const prisma = getPrisma()
    const from = input.from ? new Date(input.from) : undefined
    const to = input.to ? new Date(input.to) : undefined
    const paidAt =
      from || to
        ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
        : undefined
    const expenseDate =
      from || to
        ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
        : undefined

    let rows: ReportResult['rows'] = []
    let total = 0

    switch (kind) {
      case 'ingresos_por_dia': {
        const payments = await prisma.payment.findMany({
          where: { status: 'ACTIVO', ...(paidAt ? { paidAt } : {}) },
          select: { amount: true, paidAt: true }
        })
        const map = new Map<string, number>()
        for (const p of payments) {
          const key = format(p.paidAt, 'yyyy-MM-dd')
          map.set(key, (map.get(key) ?? 0) + p.amount)
        }
        rows = [...map.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, value]) => ({ label, value }))
        total = rows.reduce((s, r) => s + r.value, 0)
        break
      }
      case 'ventas_por_vendedor': {
        const sales = await prisma.sale.findMany({
          where: {
            status: 'ACTIVO',
            ...(from || to
              ? { soldAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
              : {})
          },
          include: { seller: true }
        })
        const map = new Map<string, { count: number; amount: number }>()
        for (const s of sales) {
          const key = s.seller.fullName
          const cur = map.get(key) ?? { count: 0, amount: 0 }
          cur.count += 1
          cur.amount += s.amount
          map.set(key, cur)
        }
        rows = [...map.entries()]
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([label, v]) => ({
            label,
            value: v.amount,
            secondary: v.count,
            meta: `${v.count} ventas`
          }))
        total = rows.reduce((s, r) => s + r.value, 0)
        break
      }
      case 'recaudo_por_vendedor': {
        const payments = await prisma.payment.findMany({
          where: { status: 'ACTIVO', ...(paidAt ? { paidAt } : {}) },
          include: { ticket: { include: { seller: true } } }
        })
        const map = new Map<string, number>()
        for (const p of payments) {
          const key = p.ticket.seller?.fullName ?? 'Sin vendedor'
          map.set(key, (map.get(key) ?? 0) + p.amount)
        }
        rows = [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value }))
        total = rows.reduce((s, r) => s + r.value, 0)
        break
      }
      case 'metodos_de_pago': {
        const payments = await prisma.payment.findMany({
          where: { status: 'ACTIVO', ...(paidAt ? { paidAt } : {}) },
          include: { paymentMethod: true }
        })
        const map = new Map<string, number>()
        for (const p of payments) {
          const key = p.paymentMethod.name
          map.set(key, (map.get(key) ?? 0) + p.amount)
        }
        rows = [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value }))
        total = rows.reduce((s, r) => s + r.value, 0)
        break
      }
      case 'boletas_por_estado': {
        const groups = await prisma.ticket.groupBy({
          by: ['status'],
          _count: { _all: true }
        })
        const settled = await prisma.ticket.count({ where: { isSettled: true } })
        rows = groups.map((g) => ({
          label: g.status,
          value: g._count._all
        }))
        rows.push({ label: 'LIQUIDADAS', value: settled, meta: 'independiente del estado' })
        total = groups.reduce((s, g) => s + g._count._all, 0)
        break
      }
      case 'egresos_por_categoria': {
        const expenses = await prisma.expense.findMany({
          where: { status: 'ACTIVO', ...(expenseDate ? { expenseDate } : {}) }
        })
        const map = new Map<string, number>()
        for (const e of expenses) {
          map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
        }
        rows = [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value }))
        total = rows.reduce((s, r) => s + r.value, 0)
        break
      }
      case 'pendientes_liquidacion': {
        const tickets = await prisma.ticket.findMany({
          where: { status: 'CANCELADA', isSettled: false },
          include: { seller: true }
        })
        const map = new Map<string, { count: number; amount: number }>()
        for (const t of tickets) {
          const key = t.seller?.fullName ?? 'Sin vendedor'
          const cur = map.get(key) ?? { count: 0, amount: 0 }
          cur.count += 1
          cur.amount += t.totalPaid
          map.set(key, cur)
        }
        rows = [...map.entries()]
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([label, v]) => ({
            label,
            value: v.amount,
            secondary: v.count,
            meta: `${v.count} boletas`
          }))
        total = rows.reduce((s, r) => s + r.value, 0)
        break
      }
    }

    return {
      ok: true,
      data: {
        kind,
        title: REPORT_TITLES[kind],
        rows,
        total
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al generar el reporte'
    }
  }
}
