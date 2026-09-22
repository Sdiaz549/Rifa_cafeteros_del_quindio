import { describe, expect, it } from 'vitest'
import { parseVoiceCommand, parseSpanishAmount } from '../src/shared/voice/parseCommand'
import { hasPermission } from '../src/shared/permissions'

describe('voice parser', () => {
  it('parses ticket 0000', () => {
    const cmd = parseVoiceCommand('buscar boleta 0000')
    expect(cmd.action).toBe('BUSCAR_BOLETA')
    expect(cmd.ticketNumber).toBe(0)
  })

  it('extracts a ticket number from extra words', () => {
    expect(parseVoiceCommand('quiero ver la veinticinco').ticketNumber).toBe(25)
  })

  it('parses spoken ticket numbers', () => {
    expect(parseVoiceCommand('buscar boleta ocho mil quinientos ochenta y siete').ticketNumber).toBe(
      8587
    )
    expect(parseVoiceCommand('cuarenta y dos').ticketNumber).toBe(42)
    expect(parseVoiceCommand('boleta cero cero cuatro dos').ticketNumber).toBe(42)
    expect(parseVoiceCommand('la boleta veinticinco').ticketNumber).toBe(25)
    expect(parseVoiceCommand('boleta veinti cinco').ticketNumber).toBe(25)
    expect(parseVoiceCommand('voleta 12').ticketNumber).toBe(12)
    expect(parseVoiceCommand('setenta treinta').ticketNumber).toBe(7030)
    expect(parseVoiceCommand('voleta quince treinta').ticketNumber).toBe(1530)
    expect(parseVoiceCommand('cero cero diecisiete').ticketNumber).toBe(17)
    expect(parseVoiceCommand('setenta y treinta').ticketNumber).toBe(7030)
    expect(parseVoiceCommand('ocho cinco ocho siete').ticketNumber).toBe(8587)
    expect(parseVoiceCommand('cincuenta a dos').ticketNumber).toBe(52)
    expect(parseVoiceCommand('cero tres veinte').ticketNumber).toBe(320)
    expect(parseVoiceCommand('cero tres veinti cinco').ticketNumber).toBe(325)
    expect(parseVoiceCommand('doce quince').ticketNumber).toBe(1215)
    expect(parseVoiceCommand('ochenta y dos diecisiete').ticketNumber).toBe(8217)
  })

  it('parses noisy spoken installment transcripts', () => {
    const cmd = parseVoiceCommand('nueve treinta mil a la boleta quince doce')
    expect(cmd.action).toBe('REGISTRAR_ABONO')
    expect(cmd.ticketNumber).toBe(1512)
    expect(cmd.amount).toBe(30000)
  })

  it('parses spoken installment with concatenated ticket groups', () => {
    const cmd = parseVoiceCommand('abono de treinta mil haga voleta setenta treinta')
    expect(cmd.action).toBe('REGISTRAR_ABONO')
    expect(cmd.ticketNumber).toBe(7030)
    expect(cmd.amount).toBe(30000)
  })

  it('parses show unsold without treating it as ticket search', () => {
    expect(parseVoiceCommand('mostrar boletas sin vender').action).toBe('MOSTRAR_SIN_VENDER')
  })

  it('parses installment command', () => {
    const cmd = parseVoiceCommand('abono de 20000 a la boleta 12 por Nequi')
    expect(cmd.action).toBe('REGISTRAR_ABONO')
    expect(cmd.ticketNumber).toBe(12)
    expect(cmd.amount).toBe(20000)
  })

  it('opens abonos from natural speech', () => {
    expect(parseVoiceCommand('haz el abono a estas boletas').action).toBe('IR_ABONOS')
    expect(parseVoiceCommand('hacer un abono').action).toBe('IR_ABONOS')
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
