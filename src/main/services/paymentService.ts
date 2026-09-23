import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { assertNonNegativeMoney } from '../../shared/money'
import { canAcceptPayment, recalcTicketFinancials } from '../../shared/domain/ticketStatus'
import type {
  ApiResult,
  CreatePaymentInput,
  PaymentSummary,
  TicketSummary,
  UpdatePaymentInput
} from '../../shared/types'
import { updateTicketBoardCell } from './ticketBoardCache'

const createPaymentSchema = z.object({
  ticketNumber: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
  paymentMethodId: z.string().min(1),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
  origin: z.enum(['MANUAL', 'VOZ']).optional()
})

const updatePaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive().optional(),
  paymentMethodId: z.string().min(1).optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional().nullable()
})

function mapTicket(t: {
  id: string
  number: number
  status: TicketSummary['status']
  isSettled: boolean
  sellerId: string | null
  buyerId: string | null
  totalAmount: number
  totalPaid: number
  balanceDue: number
  soldAt: Date | null
  seller: { fullName: string } | null
  buyer: { fullName: string } | null
}): TicketSummary {
  return {
    id: t.id,
    number: t.number,
    status: t.status,
    isSettled: t.isSettled,
    sellerId: t.sellerId,
    sellerName: t.seller?.fullName ?? null,
    buyerId: t.buyerId,
    buyerName: t.buyer?.fullName ?? null,
    totalAmount: t.totalAmount,
    totalPaid: t.totalPaid,
    balanceDue: t.balanceDue,
    soldAt: t.soldAt?.toISOString() ?? null
  }
}

function mapPayment(
  p: {
    id: string
    ticketId: string
    type: PaymentSummary['type']
    amount: number
    paidAt: Date
    paymentMethodId: string
    origin: PaymentSummary['origin']
    notes: string | null
    sequence: number
    status: PaymentSummary['status']
    paymentMethod: { name: string }
    user: { fullName: string; id?: string }
    userId: string
  },
  ticketNumber: number
): PaymentSummary {
  return {
    id: p.id,
    ticketId: p.ticketId,
    ticketNumber,
    type: p.type,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    paymentMethodId: p.paymentMethodId,
    paymentMethodName: p.paymentMethod.name,
    userId: p.userId,
    userName: p.user.fullName,
    origin: p.origin,
    notes: p.notes,
    sequence: p.sequence,
    status: p.status
  }
}

async function refreshTicketFromPayments(
  tx: Prisma.TransactionClient,
  ticket: { id: string; status: TicketSummary['status']; totalAmount: number }
) {
  const paidAgg = await tx.payment.aggregate({
    where: { ticketId: ticket.id, status: 'ACTIVO' },
    _sum: { amount: true }
  })
  const totalPaidActive = paidAgg._sum.amount ?? 0

  if (totalPaidActive <= 0 && ticket.status !== 'PERDIDA') {
    await tx.sale.updateMany({
      where: { ticketId: ticket.id, status: 'ACTIVO' },
      data: { status: 'ANULADO' }
    })
    return tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'SIN_VENDER',
        totalPaid: 0,
        balanceDue: 0,
        totalAmount: 0,
        soldAt: null
      },
      include: { seller: true, buyer: true }
    })
  }

  const financials = recalcTicketFinancials({
    totalAmount: ticket.totalAmount,
    totalPaidActive,
    currentStatus: ticket.status
  })
  return tx.ticket.update({
    where: { id: ticket.id },
    data: {
      totalPaid: financials.totalPaid,
      balanceDue: financials.balanceDue,
      status: financials.status
    },
    include: { seller: true, buyer: true }
  })
}

export async function createPayment(
  raw: unknown
): Promise<ApiResult<{ ticket: TicketSummary; payment: PaymentSummary }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'payments:create')

    const parsed = createPaymentSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: 'Datos de abono inválidos.' }
    }
    const input = parsed.data as CreatePaymentInput
    assertNonNegativeMoney(input.amount, 'valor del abono')
    if (input.amount <= 0) {
      return { ok: false, error: 'El valor del abono debe ser mayor que cero.' }
    }

    const origin = input.origin ?? 'MANUAL'
    const prisma = getPrisma()

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { number: input.ticketNumber },
        include: { seller: true, buyer: true }
      })
      if (!ticket) {
        throw new Error(`No existe la boleta ${input.ticketNumber}.`)
      }
      if (ticket.status === 'SIN_VENDER') {
        throw new Error(`La boleta ${input.ticketNumber} aún no ha sido vendida.`)
      }
      if (ticket.status === 'CANCELADA') {
        throw new Error('La boleta ya está completamente pagada.')
      }
      if (!canAcceptPayment(ticket.status)) {
        throw new Error('La boleta no admite abonos en su estado actual.')
      }
      if (input.amount > ticket.balanceDue) {
        throw new Error('El valor del abono supera el saldo pendiente.')
      }

      const method = await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } })
      if (!method || method.status !== 'ACTIVO') {
        throw new Error('Método de pago inválido o inactivo.')
      }

      const last = await tx.payment.findFirst({
        where: { ticketId: ticket.id },
        orderBy: { sequence: 'desc' }
      })
      const sequence = (last?.sequence ?? 0) + 1
      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date()

      const activeSale = await tx.sale.findFirst({
        where: { ticketId: ticket.id, status: 'ACTIVO' },
        orderBy: { createdAt: 'desc' }
      })

      const payment = await tx.payment.create({
        data: {
          ticketId: ticket.id,
          saleId: activeSale?.id ?? null,
          type: 'ABONO',
          amount: input.amount,
          paidAt,
          paymentMethodId: method.id,
          userId: session.userId,
          origin,
          notes: input.notes || null,
          status: 'ACTIVO',
          sequence
        },
        include: { paymentMethod: true, user: true }
      })

      const paidAgg = await tx.payment.aggregate({
        where: { ticketId: ticket.id, status: 'ACTIVO' },
        _sum: { amount: true }
      })
      const totalPaidActive = paidAgg._sum.amount ?? 0
      const financials = recalcTicketFinancials({
        totalAmount: ticket.totalAmount,
        totalPaidActive,
        currentStatus: ticket.status
      })

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          totalPaid: financials.totalPaid,
          balanceDue: financials.balanceDue,
          status: financials.status
        },
        include: { seller: true, buyer: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'ABONOS',
          action: 'ABONO_CREADO',
          entity: 'Payment',
          entityId: payment.id,
          newValue: JSON.stringify({
            ticketNumber: ticket.number,
            amount: input.amount,
            origin,
            newBalance: financials.balanceDue,
            newStatus: financials.status
          }),
          origin
        }
      })

      return { ticket: updated, payment }
    })

    updateTicketBoardCell(result.ticket.number, result.ticket.status, result.ticket.isSettled)
    return {
      ok: true,
      data: {
        ticket: mapTicket(result.ticket),
        payment: mapPayment(result.payment, result.ticket.number)
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al registrar el abono' }
  }
}

export async function listPaymentsByTicket(
  ticketNumber: number
): Promise<ApiResult<PaymentSummary[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:view')
    const prisma = getPrisma()
    const ticket = await prisma.ticket.findUnique({ where: { number: ticketNumber } })
    if (!ticket) {
      return { ok: false, error: `No existe la boleta ${ticketNumber}.` }
    }
    const payments = await prisma.payment.findMany({
      where: { ticketId: ticket.id },
      include: { paymentMethod: true, user: true },
      orderBy: { sequence: 'asc' }
    })
    return {
      ok: true,
      data: payments.map((p) => mapPayment(p, ticketNumber))
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al listar abonos' }
  }
}

export async function updatePayment(
  raw: unknown
): Promise<ApiResult<{ ticket: TicketSummary; payment: PaymentSummary }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'payments:create')
    const parsed = updatePaymentSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos de abono inválidos.' }
    }
    const input = parsed.data as UpdatePaymentInput
    if (input.amount != null) {
      assertNonNegativeMoney(input.amount, 'valor del abono')
    }

    const prisma = getPrisma()
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id: input.id },
        include: { ticket: true, paymentMethod: true, user: true }
      })
      if (!existing) throw new Error('No existe el abono indicado.')
      if (existing.status === 'ANULADO') throw new Error('El abono ya está anulado.')
      if (existing.ticket.status === 'PERDIDA') {
        throw new Error('No se puede editar un abono de una boleta perdida.')
      }

      const nextAmount = input.amount ?? existing.amount
      const others = await tx.payment.aggregate({
        where: { ticketId: existing.ticketId, status: 'ACTIVO', id: { not: existing.id } },
        _sum: { amount: true }
      })
      const othersPaid = others._sum.amount ?? 0
      if (existing.ticket.totalAmount > 0 && othersPaid + nextAmount > existing.ticket.totalAmount) {
        throw new Error('El valor del abono supera el saldo pendiente.')
      }

      if (input.paymentMethodId) {
        const method = await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } })
        if (!method || method.status !== 'ACTIVO') {
          throw new Error('Método de pago inválido o inactivo.')
        }
      }

      const payment = await tx.payment.update({
        where: { id: existing.id },
        data: {
          amount: nextAmount,
          ...(input.paymentMethodId ? { paymentMethodId: input.paymentMethodId } : {}),
          ...(input.paidAt ? { paidAt: new Date(input.paidAt) } : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {})
        },
        include: { paymentMethod: true, user: true }
      })

      if (existing.type === 'VENTA_INICIAL' && input.amount != null) {
        await tx.sale.updateMany({
          where: { ticketId: existing.ticketId, status: 'ACTIVO' },
          data: { initialPayment: nextAmount }
        })
      }

      const updated = await refreshTicketFromPayments(tx, existing.ticket)

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'ABONOS',
          action: 'ABONO_ACTUALIZADO',
          entity: 'Payment',
          entityId: payment.id,
          previousValue: JSON.stringify({ amount: existing.amount }),
          newValue: JSON.stringify({
            amount: payment.amount,
            ticketNumber: existing.ticket.number,
            newBalance: updated.balanceDue,
            newStatus: updated.status
          })
        }
      })

      return { ticket: updated, payment }
    })

    updateTicketBoardCell(result.ticket.number, result.ticket.status, result.ticket.isSettled)
    return {
      ok: true,
      data: {
        ticket: mapTicket(result.ticket),
        payment: mapPayment(result.payment, result.ticket.number)
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al editar el abono' }
  }
}

export async function voidPayment(
  id: string
): Promise<ApiResult<{ ticket: TicketSummary; payment: PaymentSummary }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'payments:create')
    if (!id) return { ok: false, error: 'Abono inválido.' }

    const prisma = getPrisma()
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id },
        include: { ticket: true, paymentMethod: true, user: true }
      })
      if (!existing) throw new Error('No existe el abono indicado.')
      if (existing.status === 'ANULADO') throw new Error('El abono ya está anulado.')
      if (existing.ticket.status === 'PERDIDA') {
        throw new Error('No se puede quitar un abono de una boleta perdida.')
      }

      const payment = await tx.payment.update({
        where: { id },
        data: { status: 'ANULADO' },
        include: { paymentMethod: true, user: true }
      })

      const updated = await refreshTicketFromPayments(tx, existing.ticket)

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'ABONOS',
          action: 'ABONO_ANULADO',
          entity: 'Payment',
          entityId: payment.id,
          previousValue: JSON.stringify({ amount: existing.amount, status: 'ACTIVO' }),
          newValue: JSON.stringify({
            status: 'ANULADO',
            ticketNumber: existing.ticket.number,
            newBalance: updated.balanceDue,
            newStatus: updated.status
          })
        }
      })

      return { ticket: updated, payment }
    })

    updateTicketBoardCell(result.ticket.number, result.ticket.status, result.ticket.isSettled)
    return {
      ok: true,
      data: {
        ticket: mapTicket(result.ticket),
        payment: mapPayment(result.payment, result.ticket.number)
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al quitar el abono' }
  }
}
