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

/** Tabla de boletas: de menor a mayor, `cols` números por fila. */
export function ticketNumbersTable(numbers: number[], cols = 8): string[][] {
  const sorted = [...numbers]
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b)
  const rows: string[][] = []
  for (let i = 0; i < sorted.length; i += cols) {
    const row = sorted.slice(i, i + cols).map((n) => formatTicketNumber(n))
    while (row.length < cols) row.push('')
    rows.push(row)
  }
  return rows
}
