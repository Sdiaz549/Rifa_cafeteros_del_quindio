import { DEFAULT_TICKET_COUNT, TICKET_NUMBER_PAD } from '../constants'

/** Inclusive range so 10.000 boletas = 0000–9999. */
export function ticketNumberBounds(count = DEFAULT_TICKET_COUNT): { first: number; last: number } {
  const safe = Number.isInteger(count) && count > 0 ? count : DEFAULT_TICKET_COUNT
  return { first: 0, last: safe - 1 }
}

export function formatTicketNumber(n: number, pad = TICKET_NUMBER_PAD): string {
  return String(n).padStart(pad, '0')
}

export function parseTicketNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}
