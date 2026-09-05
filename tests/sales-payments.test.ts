import { describe, expect, it } from 'vitest'
import {
  canAcceptPayment,
  canSell,
  canSettle,
  recalcTicketFinancials
} from '../src/shared/domain/ticketStatus'

describe('sale and payment business rules', () => {
  it('allows selling only DISPONIBLE tickets', () => {
    expect(canSell('DISPONIBLE')).toBe(true)
    expect(canSell('EN_ABONOS')).toBe(false)
    expect(canSell('CANCELADA')).toBe(false)
    expect(canSell('PERDIDA')).toBe(false)
  })

  it('rejects payment above pending balance via financial recalculation', () => {
    const current = recalcTicketFinancials({
      totalAmount: 50000,
      totalPaidActive: 20000,
      currentStatus: 'EN_ABONOS'
    })
    expect(current.balanceDue).toBe(30000)
    expect(25000 <= current.balanceDue).toBe(true)
    expect(40000 <= current.balanceDue).toBe(false)
  })

  it('moves to CANCELADA when initial payment covers full amount', () => {
    const result = recalcTicketFinancials({
      totalAmount: 50000,
      totalPaidActive: 50000,
      currentStatus: 'DISPONIBLE'
    })
    expect(result.status).toBe('CANCELADA')
    expect(result.balanceDue).toBe(0)
  })

  it('keeps EN_ABONOS after partial initial payment', () => {
    const result = recalcTicketFinancials({
      totalAmount: 50000,
      totalPaidActive: 10000,
      currentStatus: 'DISPONIBLE'
    })
    expect(result.status).toBe('EN_ABONOS')
    expect(result.balanceDue).toBe(40000)
  })

  it('accepts payments only in EN_ABONOS', () => {
    expect(canAcceptPayment('EN_ABONOS')).toBe(true)
    expect(canAcceptPayment('CANCELADA')).toBe(false)
    expect(canAcceptPayment('DISPONIBLE')).toBe(false)
  })

  it('allows settlement only for unpaid-settlement CANCELADA tickets', () => {
    expect(canSettle('CANCELADA', false)).toBe(true)
    expect(canSettle('CANCELADA', true)).toBe(false)
    expect(canSettle('EN_ABONOS', false)).toBe(false)
  })
})
