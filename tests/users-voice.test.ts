import { describe, expect, it } from 'vitest'
import { parseVoiceCommand, parseSpanishAmount } from '../src/shared/voice/parseCommand'
import { hasPermission } from '../src/shared/permissions'

describe('voice parser', () => {
  it('parses ticket 0000', () => {
    const cmd = parseVoiceCommand('buscar boleta 0000')
    expect(cmd.action).toBe('BUSCAR_BOLETA')
    expect(cmd.ticketNumber).toBe(0)
  })

  it('parses installment command', () => {
    const cmd = parseVoiceCommand('abono de 20000 a la boleta 12 por Nequi')
    expect(cmd.action).toBe('REGISTRAR_ABONO')
    expect(cmd.ticketNumber).toBe(12)
    expect(cmd.amount).toBe(20000)
  })

  it('parses Spanish amounts', () => {
    expect(parseSpanishAmount('cincuenta mil')).toBe(50000)
    expect(parseSpanishAmount('ciento cincuenta mil')).toBe(150000)
  })
})

describe('admin modules permissions', () => {
  it('allows ADMIN to manage users, methods and settings', () => {
    expect(hasPermission('ADMIN', 'users:manage')).toBe(true)
    expect(hasPermission('ADMIN', 'payment_methods:manage')).toBe(true)
    expect(hasPermission('ADMIN', 'settings:manage')).toBe(true)
  })

  it('blocks USER from admin catalogs', () => {
    expect(hasPermission('USER', 'users:manage')).toBe(false)
    expect(hasPermission('USER', 'payment_methods:manage')).toBe(false)
    expect(hasPermission('USER', 'settings:manage')).toBe(false)
  })
})
