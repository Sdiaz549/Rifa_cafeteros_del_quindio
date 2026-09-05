import { describe, expect, it } from 'vitest'
import { formatCop, parseCopInput, assertNonNegativeMoney } from '../src/shared/money'
import { hasPermission } from '../src/shared/permissions'
import {
  recalcTicketFinancials,
  canAcceptPayment,
  canSell,
  canSettle
} from '../src/shared/domain/ticketStatus'
import { parseVoiceCommand, parseSpanishAmount } from '../src/shared/voice/parseCommand'

describe('money', () => {
  it('formats COP without decimals', () => {
    expect(formatCop(50000)).toBe('$ 50.000')
  })

  it('parses input stripping symbols', () => {
    expect(parseCopInput('$ 50.000')).toBe(50000)
  })

  it('rejects non-integer money', () => {
    expect(() => assertNonNegativeMoney(10.5)).toThrow()
    expect(() => assertNonNegativeMoney(-1)).toThrow()
  })
})

describe('permissions', () => {
  it('allows admin dashboard and denies user', () => {
    expect(hasPermission('ADMIN', 'dashboard:view')).toBe(true)
    expect(hasPermission('USER', 'dashboard:view')).toBe(false)
  })

  it('allows user to sell tickets', () => {
    expect(hasPermission('USER', 'tickets:sell')).toBe(true)
    expect(hasPermission('USER', 'backups:manage')).toBe(false)
  })
})

describe('ticket financials', () => {
  it('moves to CANCELADA when balance is zero', () => {
    const result = recalcTicketFinancials({
      totalAmount: 50000,
      totalPaidActive: 50000,
      currentStatus: 'EN_ABONOS'
    })
    expect(result.status).toBe('CANCELADA')
    expect(result.balanceDue).toBe(0)
  })

  it('keeps PERDIDA terminal', () => {
    const result = recalcTicketFinancials({
      totalAmount: 50000,
      totalPaidActive: 10000,
      currentStatus: 'PERDIDA'
    })
    expect(result.status).toBe('PERDIDA')
  })

  it('gates sell/pay/settle correctly', () => {
    expect(canSell('DISPONIBLE')).toBe(true)
    expect(canSell('EN_ABONOS')).toBe(false)
    expect(canAcceptPayment('EN_ABONOS')).toBe(true)
    expect(canAcceptPayment('CANCELADA')).toBe(false)
    expect(canSettle('CANCELADA', false)).toBe(true)
    expect(canSettle('CANCELADA', true)).toBe(false)
  })
})

describe('voice parser', () => {
  it('parses spanish amounts', () => {
    expect(parseSpanishAmount('cincuenta mil')).toBe(50000)
  })

  it('parses buscar boleta', () => {
    const cmd = parseVoiceCommand('Buscar boleta 8587')
    expect(cmd.action).toBe('BUSCAR_BOLETA')
    expect(cmd.ticketNumber).toBe(8587)
  })

  it('parses registrar abono', () => {
    const cmd = parseVoiceCommand(
      'Registrar abono de cincuenta mil pesos a la boleta 8587 por Nequi'
    )
    expect(cmd.action).toBe('REGISTRAR_ABONO')
    expect(cmd.ticketNumber).toBe(8587)
    expect(cmd.amount).toBe(50000)
  })
})
