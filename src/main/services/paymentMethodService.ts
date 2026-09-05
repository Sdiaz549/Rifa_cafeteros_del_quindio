import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import type { ApiResult, PaymentMethodSummary } from '../../shared/types'

export async function listActivePaymentMethods(): Promise<ApiResult<PaymentMethodSummary[]>> {
  try {
    requireSession()
    const prisma = getPrisma()
    const methods = await prisma.paymentMethod.findMany({
      where: { status: 'ACTIVO' },
      orderBy: { name: 'asc' }
    })
    return {
      ok: true,
      data: methods.map((m) => ({ id: m.id, name: m.name, status: m.status }))
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar métodos de pago'
    }
  }
}
