import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { assertNonNegativeMoney } from '../../shared/money'
import { canSell, recalcTicketFinancials } from '../../shared/domain/ticketStatus'
import type { ApiResult, CreateSaleInput, TicketSummary } from '../../shared/types'

const buyerInlineSchema = z.object({
  fullName: z.string().min(2),
  documentId: z.string().min(3),
  phone: z.string().min(5),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal(''))
})

const createSaleSchema = z.object({
  ticketNumber: z.number().int().positive(),
  sellerId: z.string().min(1),
  buyerId: z.string().optional(),
  buyer: buyerInlineSchema.optional(),
  amount: z.number().int().positive(),
  initialPayment: z.number().int().nonnegative(),
  paymentMethodId: z.string().min(1),
  soldAt: z.string().optional(),
  notes: z.string().optional()
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

export async function createSale(raw: unknown): Promise<ApiResult<TicketSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'tickets:sell')

    const parsed = createSaleSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: 'Datos de venta inválidos.' }
    }
    const input = parsed.data as CreateSaleInput
    assertNonNegativeMoney(input.amount, 'valor de la boleta')
    assertNonNegativeMoney(input.initialPayment, 'pago inicial')

    if (input.initialPayment > input.amount) {
      return { ok: false, error: 'El pago inicial no puede superar el valor de la boleta.' }
    }
    if (!input.buyerId && !input.buyer) {
      return { ok: false, error: 'Debe indicar un comprador existente o crear uno nuevo.' }
    }

    const prisma = getPrisma()

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { number: input.ticketNumber } })
      if (!ticket) {
        throw new Error(`No existe la boleta ${input.ticketNumber}.`)
      }
      if (!canSell(ticket.status)) {
        throw new Error(`La boleta ${input.ticketNumber} ya está vendida o no está disponible.`)
      }

      const seller = await tx.seller.findUnique({ where: { id: input.sellerId } })
      if (!seller || seller.status !== 'ACTIVO') {
        throw new Error('El vendedor no existe o está inactivo.')
      }

      const method = await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } })
      if (!method || method.status !== 'ACTIVO') {
        throw new Error('Método de pago inválido o inactivo.')
      }

      let buyerId = input.buyerId
      if (!buyerId && input.buyer) {
        const existing = await tx.buyer.findUnique({
          where: { documentId: input.buyer.documentId }
        })
        if (existing) {
          buyerId = existing.id
          await tx.buyer.update({
            where: { id: existing.id },
            data: {
              fullName: input.buyer.fullName,
              phone: input.buyer.phone,
              address: input.buyer.address || existing.address,
              email: input.buyer.email || existing.email
            }
          })
        } else {
          const created = await tx.buyer.create({
            data: {
              fullName: input.buyer.fullName,
              documentId: input.buyer.documentId,
              phone: input.buyer.phone,
              address: input.buyer.address || null,
              email: input.buyer.email || null
            }
          })
          buyerId = created.id
        }
      }

      if (!buyerId) {
        throw new Error('No se pudo determinar el comprador.')
      }

      const soldAt = input.soldAt ? new Date(input.soldAt) : new Date()
      const financials = recalcTicketFinancials({
        totalAmount: input.amount,
        totalPaidActive: input.initialPayment,
        currentStatus: 'DISPONIBLE'
      })
      const nextStatus =
        financials.status === 'DISPONIBLE' ? 'EN_ABONOS' : financials.status

      const sale = await tx.sale.create({
        data: {
          ticketId: ticket.id,
          buyerId,
          sellerId: seller.id,
          amount: input.amount,
          soldAt,
          initialPayment: input.initialPayment,
          paymentMethodId: method.id,
          notes: input.notes || null,
          status: 'ACTIVO',
          createdByUserId: session.userId
        }
      })

      if (input.initialPayment > 0) {
        await tx.payment.create({
          data: {
            ticketId: ticket.id,
            saleId: sale.id,
            type: 'VENTA_INICIAL',
            amount: input.initialPayment,
            paidAt: soldAt,
            paymentMethodId: method.id,
            userId: session.userId,
            origin: 'MANUAL',
            notes: input.notes || null,
            status: 'ACTIVO',
            sequence: 1
          }
        })
      }

      const ticketUpdated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          sellerId: seller.id,
          buyerId,
          soldAt,
          totalAmount: financials.totalAmount,
          totalPaid: financials.totalPaid,
          balanceDue: financials.balanceDue,
          notes: input.notes || ticket.notes
        },
        include: { seller: true, buyer: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'VENTAS',
          action: 'VENTA_CREADA',
          entity: 'Sale',
          entityId: sale.id,
          newValue: JSON.stringify({
            ticketNumber: ticket.number,
            amount: input.amount,
            initialPayment: input.initialPayment,
            buyerId,
            sellerId: seller.id,
            status: nextStatus
          }),
          origin: 'MANUAL'
        }
      })

      return ticketUpdated
    })

    return { ok: true, data: mapTicket(updated) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al registrar la venta' }
  }
}
