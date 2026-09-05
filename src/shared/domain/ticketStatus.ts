import type { TicketStatus } from '../types'

export interface TicketAmounts {
  totalAmount: number
  totalPaid: number
  balanceDue: number
  status: TicketStatus
}

/** Recalculate cached money fields and payment status (not settlement). */
export function recalcTicketFinancials(input: {
  totalAmount: number
  totalPaidActive: number
  currentStatus: TicketStatus
}): TicketAmounts {
  const totalAmount = Math.trunc(input.totalAmount)
  const totalPaid = Math.trunc(input.totalPaidActive)
  const balanceDue = Math.max(0, totalAmount - totalPaid)

  if (input.currentStatus === 'PERDIDA') {
    return {
      totalAmount,
      totalPaid,
      balanceDue,
      status: 'PERDIDA'
    }
  }

  if (totalPaid <= 0) {
    // Still sold with zero paid? Treat as EN_ABONOS if there is a sale amount.
    if (totalAmount > 0) {
      return { totalAmount, totalPaid: 0, balanceDue: totalAmount, status: 'EN_ABONOS' }
    }
    return { totalAmount: 0, totalPaid: 0, balanceDue: 0, status: 'DISPONIBLE' }
  }

  if (balanceDue === 0) {
    return { totalAmount, totalPaid, balanceDue: 0, status: 'CANCELADA' }
  }

  return { totalAmount, totalPaid, balanceDue, status: 'EN_ABONOS' }
}

export function canAcceptPayment(status: TicketStatus): boolean {
  return status === 'EN_ABONOS'
}

export function canSell(status: TicketStatus): boolean {
  return status === 'DISPONIBLE'
}

export function canSettle(status: TicketStatus, isSettled: boolean): boolean {
  return status === 'CANCELADA' && !isSettled
}

export function ticketStatusLabel(status: TicketStatus): string {
  switch (status) {
    case 'DISPONIBLE':
      return 'Sin vender'
    case 'EN_ABONOS':
      return 'En abonos'
    case 'CANCELADA':
      return 'Cancelada'
    case 'PERDIDA':
      return 'Perdida'
    default:
      return status
  }
}
