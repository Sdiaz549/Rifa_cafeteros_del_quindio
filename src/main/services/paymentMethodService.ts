import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { writeAuditLog } from '../audit/auditService'
import type { ApiResult, PaymentMethodSummary } from '../../shared/types'

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'El nombre es obligatorio.'),
  status: z.enum(['ACTIVO', 'INACTIVO']).optional()
})

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

export async function listPaymentMethods(): Promise<ApiResult<PaymentMethodSummary[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'payment_methods:manage')
    const methods = await getPrisma().paymentMethod.findMany({ orderBy: { name: 'asc' } })
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

export async function upsertPaymentMethod(raw: unknown): Promise<ApiResult<PaymentMethodSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'payment_methods:manage')
    const parsed = upsertSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const prisma = getPrisma()
    const byName = await prisma.paymentMethod.findUnique({ where: { name: parsed.data.name } })
    if (byName && byName.id !== parsed.data.id) {
      return { ok: false, error: 'Ya existe un método de pago con ese nombre.' }
    }

    const method = parsed.data.id
      ? await prisma.paymentMethod.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name,
            status: parsed.data.status ?? undefined
          }
        })
      : await prisma.paymentMethod.create({
          data: {
            name: parsed.data.name,
            status: parsed.data.status ?? 'ACTIVO'
          }
        })

    await writeAuditLog({
      userId: session.userId,
      module: 'METODOS_PAGO',
      action: parsed.data.id ? 'METODO_ACTUALIZADO' : 'METODO_CREADO',
      entity: 'PaymentMethod',
      entityId: method.id,
      newValue: { name: method.name, status: method.status }
    })

    return { ok: true, data: { id: method.id, name: method.name, status: method.status } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al guardar método de pago' }
  }
}
