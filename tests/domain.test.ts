import { describe, expect, it } from 'vitest'
import { formatCop, parseCopInput, formatCopInputValue, assertNonNegativeMoney } from '../src/shared/money'
import { hasPermission } from '../src/shared/permissions'
import {
  recalcTicketFinancials,
  canAcceptPayment,
  canSell,
  canSettle,
  canAssign
} from '../src/shared/domain/ticketStatus'
import { parseVoiceCommand, parseSpanishAmount } from '../src/shared/voice/parseCommand'
import { formatTicketNumber, parseTicketNumber, ticketNumberBounds, ticketNumbersTable } from '../src/shared/tickets/numbers'
import { packTicketCell, unpackTicketCell, boardStatsFromPacked, boardIndexForQuery } from '../src/shared/tickets/board'

describe('ticket numbers', () => {
  it('uses 0000–9999 for 10.000 boletas', () => {
    expect(ticketNumberBounds(10_000)).toEqual({ first: 0, last: 9999 })
    expect(formatTicketNumber(0)).toBe('0000')
    expect(formatTicketNumber(9999)).toBe('9999')
    expect(parseTicketNumber('0000')).toBe(0)
    expect(parseTicketNumber('0042')).toBe(42)
  })

  it('builds a sorted ticket number table', () => {
    expect(ticketNumbersTable([20, 1, 10], 2)).toEqual([
      ['0001', '0010'],
      ['0020', '']
    ])
  })
})

describe('ticket board packing', () => {
  it('packs status and settled bit', () => {
    expect(unpackTicketCell(packTicketCell('EN_ABONOS', true))).toEqual({
      status: 'EN_ABONOS',
      isSettled: true
    })
    const stats = boardStatsFromPacked([
      packTicketCell('SIN_VENDER', false),
      packTicketCell('CANCELADA', true),
      packTicketCell('CANCELADA', false)
    ])
    expect(stats.disponible).toBe(1)
    expect(stats.cancelada).toBe(2)
    expect(stats.liquidadas).toBe(1)
    expect(stats.pendLiq).toBe(1)
    expect(stats.vendidas).toBe(2)
  })

  it('finds a ticket index from the search query', () => {
    expect(boardIndexForQuery(0, 10_000, '0042')).toBe(42)
    expect(boardIndexForQuery(0, 10_000, '42')).toBe(42)
    expect(boardIndexForQuery(0, 10_000, '9999')).toBe(9999)
    expect(boardIndexForQuery(0, 10_000, '10000')).toBe(null)
    expect(boardIndexForQuery(0, 10_000, '')).toBe(null)
  })
})

describe('money', () => {
  it('formats COP without decimals', () => {
    expect(formatCop(50000)).toBe('$ 50.000')
  })

  it('parses input stripping symbols', () => {
    expect(parseCopInput('$ 50.000')).toBe(50000)
    expect(parseCopInput('20,000')).toBe(20000)
  })

  it('formats abono input with comma thousands', () => {
    expect(formatCopInputValue('20000')).toBe('20,000')
    expect(formatCopInputValue('20,000')).toBe('20,000')
    expect(formatCopInputValue('')).toBe('')
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

  it('gates sell/pay/settle/assign correctly', () => {
    expect(canSell('SIN_VENDER')).toBe(true)
    expect(canSell('EN_ABONOS')).toBe(false)
    expect(canAssign('SIN_VENDER')).toBe(true)
    expect(canAssign('EN_ABONOS')).toBe(true)
    expect(canAssign('CANCELADA')).toBe(true)
    expect(canAssign('PERDIDA')).toBe(false)
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
