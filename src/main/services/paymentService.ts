import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { assertNonNegativeMoney } from '../../shared/money'
import { canAcceptPayment, recalcTicketFinancials } from '../../shared/domain/ticketStatus'
import type {
  ApiResult,
  CreatePaymentInput,
  PaymentSummary,
  TicketSummary
} from '../../shared/types'

const createPaymentSchema = z.object({
  ticketNumber: z.number().int().positive(),
  amount: z.number().int().positive(),
  paymentMethodId: z.string().min(1),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
  origin: z.enum(['MANUAL', 'VOZ']).optional()
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
      if (ticket.status === 'DISPONIBLE') {
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

    return {
      ok: true,
      data: {
        ticket: mapTicket(result.ticket),
        payment: {
          id: result.payment.id,
          ticketId: result.payment.ticketId,
          ticketNumber: result.ticket.number,
          type: result.payment.type,
          amount: result.payment.amount,
          paidAt: result.payment.paidAt.toISOString(),
          paymentMethodId: result.payment.paymentMethodId,
          paymentMethodName: result.payment.paymentMethod.name,
          userId: result.payment.userId,
          userName: result.payment.user.fullName,
          origin: result.payment.origin,
          notes: result.payment.notes,
          sequence: result.payment.sequence,
          status: result.payment.status
        }
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
      data: payments.map((p) => ({
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
      }))
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al listar abonos' }
  }
}
