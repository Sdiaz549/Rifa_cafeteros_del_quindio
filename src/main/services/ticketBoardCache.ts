import { BrowserWindow } from 'electron'
import type { TicketBoardLiveUpdate, TicketBoardSnapshot, TicketStatus } from '../../shared/types'
import { IPC_EVENTS } from '../../shared/ipc/channels'
import { packTicketCell } from '../../shared/tickets/board'
import { getPrisma } from '../db/client'

let cache: TicketBoardSnapshot | null = null

function broadcastBoardUpdate(payload: TicketBoardLiveUpdate): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_EVENTS.TICKETS_BOARD_UPDATED, payload)
    }
  }
}

export function invalidateTicketBoard(): void {
  cache = null
  broadcastBoardUpdate({ type: 'full' })
}

export function updateTicketBoardCell(
  number: number,
  status: TicketStatus,
  isSettled: boolean
): void {
  if (cache) {
    const i = number - cache.first
    if (i >= 0 && i < cache.packed.length) {
      const packed = cache.packed.slice()
      packed[i] = packTicketCell(status, isSettled)
      cache = { first: cache.first, packed }
    }
  }
  broadcastBoardUpdate({ type: 'cell', number, status, isSettled })
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
  const first = Number(rows[0].number)
  const last = Number(rows[rows.length - 1].number)
  const packed = new Array<number>(last - first + 1).fill(0)
  for (const row of rows) {
    packed[Number(row.number) - first] = packTicketCell(row.status, Boolean(row.isSettled))
  }
  cache = { first, packed }
  return cache
}
