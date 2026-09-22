import { describe, expect, it } from 'vitest'
import { formatCop } from '../src/shared/money'
import { formatTicketNumber } from '../src/shared/tickets/numbers'
import { IPC_CHANNELS, isAllowedIpcChannel } from '../src/shared/ipc/channels'
import { hasPermission } from '../src/shared/permissions'
import {
  buildSellerPaymentsDocx,
  buildSellerTicketsDocx
} from '../src/main/services/sellerDocx'

function asText(buf: Buffer): string {
  return buf.toString('utf8')
}

describe('seller word exports', () => {
  it('registers Word export IPC channels', () => {
    expect(IPC_CHANNELS.SELLERS_EXPORT_TICKETS_WORD).toBe('sellers:exportTicketsWord')
    expect(IPC_CHANNELS.SELLERS_EXPORT_PAYMENTS_WORD).toBe('sellers:exportPaymentsWord')
    expect(isAllowedIpcChannel('sellers:exportTicketsWord')).toBe(true)
    expect(isAllowedIpcChannel('sellers:exportPaymentsWord')).toBe(true)
  })

  it('allows admin and operador to export seller documents', () => {
    expect(hasPermission('ADMIN', 'sellers:manage')).toBe(true)
    expect(hasPermission('USER', 'sellers:manage')).toBe(true)
  })

  it('builds a tickets Word with seller name and padded numbers sorted', () => {
    const buf = buildSellerTicketsDocx('Pedro', [20, 1, 10])
    expect(buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true)
    const text = asText(buf)
    expect(text).toContain('word/document.xml')
    expect(text).toContain('Pedro')
    expect(text).toContain('0001')
    expect(text).toContain('0010')
    expect(text).toContain('0020')
    expect(text.indexOf('0001')).toBeLessThan(text.indexOf('0010'))
    expect(text.indexOf('0010')).toBeLessThan(text.indexOf('0020'))
  })

  it('builds a payment relation with how much each ticket has paid', () => {
    const tickets = [
      { number: 16, totalPaid: 20000 },
      { number: 3, totalPaid: 0 },
      { number: 42, totalPaid: 15000 }
    ]
    const buf = buildSellerPaymentsDocx('Juana Pérez', tickets)
    const text = asText(buf)
    expect(buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true)
    expect(text).toContain('Relación de pagos')
    expect(text).toContain('Juana Pérez')
    expect(text).toContain('Boleta')
    expect(text).toContain('Lleva')
    expect(text).toContain(formatTicketNumber(16))
    expect(text).toContain(formatTicketNumber(3))
    expect(text).toContain(formatTicketNumber(42))
    expect(text).toContain(formatCop(20000))
    expect(text).toContain(formatCop(0))
    expect(text).toContain(formatCop(15000))
    expect(text).toContain('Total')
    expect(text).toContain(formatCop(35000))
    expect(text.indexOf(formatTicketNumber(3))).toBeLessThan(text.indexOf(formatTicketNumber(16)))
    expect(text.indexOf(formatTicketNumber(16))).toBeLessThan(text.indexOf(formatTicketNumber(42)))
    expect(text).not.toContain('EN_ABONOS')
  })

  it('escapes seller names in Word XML', () => {
    const text = asText(buildSellerPaymentsDocx('Ana & Co <x>', [{ number: 1, totalPaid: 1000 }]))
    expect(text).toContain('Ana &amp; Co &lt;x&gt;')
    expect(text).not.toContain('Ana & Co <x>')
  })
})
