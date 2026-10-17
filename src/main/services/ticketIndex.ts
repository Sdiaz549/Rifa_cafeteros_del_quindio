import type { TicketStatus, TicketSummary } from '../../shared/types'
import { publicDocumentId } from '../../shared/identity'
import { getPrisma } from '../db/client'
import { logInfo } from '../logging/appLogger'

const byNumber = new Map<number, TicketSummary>()

export function rememberTicket(ticket: TicketSummary): void {
  byNumber.set(ticket.number, ticket)
}

export function getIndexedTicket(number: number): TicketSummary | undefined {
  return byNumber.get(number)
}

export function listIndexedTickets(input?: {
  query?: string
  status?: TicketStatus
  isSettled?: boolean
  sellerId?: string
  take?: number
  skip?: number
}): { items: TicketSummary[]; total: number } {
  const take = Math.min(Math.max(input?.take ?? 250, 1), 10000)
  const skip = Math.max(input?.skip ?? 0, 0)
  const q = input?.query?.trim().toLowerCase()
  const asNumber = q && /^\d+$/.test(q) ? Number(q) : null

  const items: TicketSummary[] = []
  const numbers = [...byNumber.keys()].sort((a, b) => a - b)
  for (const number of numbers) {
    const ticket = byNumber.get(number)
    if (!ticket) continue
    if (input?.status && ticket.status !== input.status) continue
    if (input?.isSettled === true && !ticket.isSettled) continue
    if (input?.isSettled === false && ticket.isSettled) continue
    if (input?.sellerId && ticket.sellerId !== input.sellerId) continue
    if (q) {
      if (asNumber != null) {
        if (ticket.number !== asNumber) continue
      } else if (
        !ticket.buyerName?.toLowerCase().includes(q) &&
        !ticket.buyerDocumentId?.toLowerCase().includes(q) &&
        !ticket.buyerPhone?.toLowerCase().includes(q) &&
        !ticket.sellerName?.toLowerCase().includes(q)
      ) {
        continue
      }
    }
    items.push(ticket)
  }

  return {
    items: items.slice(skip, skip + take),
    total: items.length
  }
}

export async function loadTicketIndex(): Promise<number> {
  const prisma = getPrisma()
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      number: number
      status: TicketStatus
      isSettled: number | boolean
      sellerId: string | null
      buyerId: string | null
      totalAmount: number
      totalPaid: number
      balanceDue: number
      soldAt: Date | string | null
      sellerName: string | null
      buyerName: string | null
      buyerDocumentId: string | null
      buyerPhone: string | null
      buyerAddress: string | null
    }>
  >`
    SELECT
      t.id,
      t.number,
      t.status,
      t.isSettled,
      t.sellerId,
      t.buyerId,
      t.totalAmount,
      t.totalPaid,
      t.balanceDue,
      t.soldAt,
      s.fullName AS sellerName,
      b.fullName AS buyerName,
      b.documentId AS buyerDocumentId,
      b.phone AS buyerPhone,
      b.address AS buyerAddress
    FROM "Ticket" t
    LEFT JOIN "Seller" s ON s.id = t.sellerId
    LEFT JOIN "Buyer" b ON b.id = t.buyerId
  `

  byNumber.clear()
  for (const row of rows) {
    rememberTicket({
      id: row.id,
      number: Number(row.number),
      status: row.status,
      isSettled: Boolean(row.isSettled),
      sellerId: row.sellerId,
      sellerName: row.sellerName,
      buyerId: row.buyerId,
      buyerName: row.buyerName,
      buyerDocumentId: publicDocumentId(row.buyerDocumentId) || null,
      buyerPhone: row.buyerPhone?.trim() ? row.buyerPhone : null,
      buyerAddress: row.buyerAddress,
      totalAmount: Number(row.totalAmount) || 0,
      totalPaid: Number(row.totalPaid) || 0,
      balanceDue: Number(row.balanceDue) || 0,
      soldAt: row.soldAt ? new Date(row.soldAt).toISOString() : null
    })
  }
  logInfo('tickets.index.loaded', { count: byNumber.size })
  return byNumber.size
}
