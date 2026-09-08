import { describe, expect, it } from 'vitest'
import { canSettle } from '../src/shared/domain/ticketStatus'
import { hasPermission } from '../src/shared/permissions'

/** Pure helpers mirroring settlement/unsold percentage rules used by services. */
function unsoldPercent(unsoldCount: number, ticketCount: number): number {
  if (ticketCount <= 0) return 0
  return Math.round((unsoldCount / ticketCount) * 1000) / 10
}

describe('settlement rules', () => {
  it('allows settling only CANCELADA tickets that are not settled', () => {
    expect(canSettle('CANCELADA', false)).toBe(true)
    expect(canSettle('CANCELADA', true)).toBe(false)
    expect(canSettle('EN_ABONOS', false)).toBe(false)
    expect(canSettle('DISPONIBLE', false)).toBe(false)
    expect(canSettle('PERDIDA', false)).toBe(false)
  })

  it('restricts settlements to ADMIN', () => {
    expect(hasPermission('ADMIN', 'settlements:manage')).toBe(true)
    expect(hasPermission('USER', 'settlements:manage')).toBe(false)
  })

  it('keeps isSettled independent of payment status conceptually', () => {
    // CANCELADA + not settled = pending settlement
    expect(canSettle('CANCELADA', false)).toBe(true)
    // After settlement, status remains CANCELADA but canSettle is false
    expect(canSettle('CANCELADA', true)).toBe(false)
  })
})

describe('unsold by seller indicators', () => {
  it('computes percentage of unsold vs assigned tickets', () => {
    expect(unsoldPercent(5, 20)).toBe(25)
    expect(unsoldPercent(1, 3)).toBe(33.3)
    expect(unsoldPercent(0, 10)).toBe(0)
    expect(unsoldPercent(2, 0)).toBe(0)
  })

  it('allows USER to view unsold module', () => {
    expect(hasPermission('USER', 'unsold:view')).toBe(true)
    expect(hasPermission('ADMIN', 'unsold:view')).toBe(true)
  })
})
