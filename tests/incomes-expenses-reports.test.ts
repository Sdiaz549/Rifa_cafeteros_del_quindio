import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/shared/permissions'
import { listReportKinds } from '../src/main/services/reportService'
import { EXPENSE_CATEGORIES } from '../src/main/services/expenseService'

describe('incomes/expenses permissions', () => {
  it('restricts incomes and expenses to ADMIN', () => {
    expect(hasPermission('ADMIN', 'incomes:view')).toBe(true)
    expect(hasPermission('USER', 'incomes:view')).toBe(false)
    expect(hasPermission('ADMIN', 'expenses:manage')).toBe(true)
    expect(hasPermission('USER', 'expenses:manage')).toBe(false)
  })
})

describe('reports catalog', () => {
  it('gives USER only operational reports', () => {
    const kinds = listReportKinds('USER').map((k) => k.kind)
    expect(kinds).toContain('ventas_por_vendedor')
    expect(kinds).not.toContain('ingresos_por_dia')
    expect(kinds).not.toContain('egresos_por_categoria')
  })

  it('gives ADMIN financial and operational reports', () => {
    const kinds = listReportKinds('ADMIN').map((k) => k.kind)
    expect(kinds).toContain('ingresos_por_dia')
    expect(kinds).toContain('egresos_por_categoria')
    expect(kinds).toContain('pendientes_liquidacion')
  })
})

describe('expense categories', () => {
  it('exposes a non-empty category catalog', () => {
    expect(EXPENSE_CATEGORIES.length).toBeGreaterThan(0)
    expect(EXPENSE_CATEGORIES).toContain('OPERACION')
  })
})
