import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { assertNonNegativeMoney } from '../../shared/money'
import type {
  ApiResult,
  CreateExpenseInput,
  ExpenseListResult,
  ExpenseSummary
} from '../../shared/types'

export const EXPENSE_CATEGORIES = [
  'OPERACION',
  'PREMIOS',
  'ADMINISTRATIVO',
  'LOGISTICA',
  'OTROS'
] as const

const createExpenseSchema = z.object({
  expenseDate: z.string().optional(),
  concept: z.string().min(2),
  category: z.string().min(2),
  amount: z.number().int().positive(),
  paymentMethodId: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
})

function mapExpense(e: {
  id: string
  expenseDate: Date
  concept: string
  category: string
  amount: number
  paymentMethodId: string | null
  notes: string | null
  userId: string
  status: ExpenseSummary['status']
  paymentMethod: { name: string } | null
  user: { fullName: string }
}): ExpenseSummary {
  return {
    id: e.id,
    expenseDate: e.expenseDate.toISOString(),
    concept: e.concept,
    category: e.category,
    amount: e.amount,
    paymentMethodId: e.paymentMethodId,
    paymentMethodName: e.paymentMethod?.name ?? null,
    notes: e.notes,
    userId: e.userId,
    userName: e.user.fullName,
    status: e.status
  }
}

export async function listExpenses(input?: {
  from?: string
  to?: string
  category?: string
  query?: string
  take?: number
}): Promise<ApiResult<ExpenseListResult>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'expenses:manage')
    const prisma = getPrisma()
    const from = input?.from ? new Date(input.from) : undefined
    const to = input?.to ? new Date(input.to) : undefined
    const take = input?.take ?? 300
    const q = input?.query?.trim()

    const where = {
      status: 'ACTIVO' as const,
      ...(input?.category ? { category: input.category } : {}),
      ...(from || to
        ? {
            expenseDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          }
        : {}),
      ...(q
        ? {
            OR: [
              { concept: { contains: q } },
              { category: { contains: q } },
              { notes: { contains: q } }
            ]
          }
        : {})
    }

    const [items, total, agg] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { paymentMethod: true, user: true },
        orderBy: { expenseDate: 'desc' },
        take
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } })
    ])

    return {
      ok: true,
      data: {
        items: items.map(mapExpense),
        total,
        totalAmount: agg._sum.amount ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al listar egresos'
    }
  }
}

export async function createExpense(
  raw: unknown
): Promise<ApiResult<ExpenseSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'expenses:manage')

    const parsed = createExpenseSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: 'Datos de egreso inválidos.' }
    }
    const input = parsed.data as CreateExpenseInput
    assertNonNegativeMoney(input.amount, 'valor del egreso')
    if (input.amount <= 0) {
      return { ok: false, error: 'El valor del egreso debe ser mayor que cero.' }
    }

    const prisma = getPrisma()
    if (input.paymentMethodId) {
      const method = await prisma.paymentMethod.findUnique({
        where: { id: input.paymentMethodId }
      })
      if (!method || method.status !== 'ACTIVO') {
        return { ok: false, error: 'Método de pago inválido o inactivo.' }
      }
    }

    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date()

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          expenseDate,
          concept: input.concept.trim(),
          category: input.category.trim(),
          amount: input.amount,
          paymentMethodId: input.paymentMethodId || null,
          notes: input.notes?.trim() || null,
          userId: session.userId,
          status: 'ACTIVO'
        },
        include: { paymentMethod: true, user: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'EGRESOS',
          action: 'EGRESO_CREADO',
          entity: 'Expense',
          entityId: created.id,
          newValue: JSON.stringify({
            concept: created.concept,
            category: created.category,
            amount: created.amount,
            expenseDate: created.expenseDate.toISOString()
          })
        }
      })

      return created
    })

    return { ok: true, data: mapExpense(expense) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al registrar el egreso'
    }
  }
}

export async function voidExpense(id: string): Promise<ApiResult<ExpenseSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'expenses:manage')
    const prisma = getPrisma()

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findUnique({
        where: { id },
        include: { paymentMethod: true, user: true }
      })
      if (!existing) {
        throw new Error('No existe el egreso indicado.')
      }
      if (existing.status === 'ANULADO') {
        throw new Error('El egreso ya está anulado.')
      }

      const updated = await tx.expense.update({
        where: { id },
        data: { status: 'ANULADO' },
        include: { paymentMethod: true, user: true }
      })

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          module: 'EGRESOS',
          action: 'EGRESO_ANULADO',
          entity: 'Expense',
          entityId: id,
          previousValue: JSON.stringify({ status: 'ACTIVO', amount: existing.amount }),
          newValue: JSON.stringify({ status: 'ANULADO' })
        }
      })

      return updated
    })

    return { ok: true, data: mapExpense(result) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al anular el egreso'
    }
  }
}
