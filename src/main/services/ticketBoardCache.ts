import type { TicketStatus } from '../../shared/types'
import type { TicketBoardSnapshot } from '../../shared/types'
import { packTicketCell } from '../../shared/tickets/board'
import { getPrisma } from '../db/client'

let cache: TicketBoardSnapshot | null = null

export function invalidateTicketBoard(): void {
  cache = null
}

export async function loadTicketBoardSnapshot(): Promise<TicketBoardSnapshot> {
  if (cache) return cache
  const prisma = getPrisma()
  const rows = await prisma.$queryRaw<
    Array<{ number: number; status: TicketStatus; isSettled: number | boolean }>
  >`
    SELECT number, status, isSettled FROM "Ticket" ORDER BY number
  `
  if (rows.length === 0) {
    cache = { first: 0, packed: [] }
    return cache
  }
  const first = rows[0].number
  const last = rows[rows.length - 1].number
  const packed = new Array<number>(last - first + 1).fill(0)
  for (const row of rows) {
    packed[row.number - first] = packTicketCell(row.status, Boolean(row.isSettled))
  }
  cache = { first, packed }
  return cache
}
