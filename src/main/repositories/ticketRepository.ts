import type { TicketStatus } from '@prisma/client'
import { getPrisma } from '../db/client'

export function ticketRepository() {
  const prisma = getPrisma()
  return {
    count: (status?: TicketStatus) =>
      prisma.ticket.count(status ? { where: { status } } : undefined),
    countSettled: () => prisma.ticket.count({ where: { isSettled: true } }),
    sumBalanceDue: (status?: TicketStatus) =>
      prisma.ticket.aggregate({
        where: status ? { status } : undefined,
        _sum: { balanceDue: true }
      }),
    sumTotalPaid: () =>
      prisma.ticket.aggregate({
        _sum: { totalPaid: true }
      })
  }
}
