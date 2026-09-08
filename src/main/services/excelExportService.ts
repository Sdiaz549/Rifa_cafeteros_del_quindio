import ExcelJS from 'exceljs'
import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { format } from 'date-fns'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import type { ApiResult } from '../../shared/types'

export const EXPORT_SHEET_NAMES = [
  'Boletas',
  'Compradores',
  'Vendedores',
  'Ventas',
  'Pagos',
  'Liquidaciones',
  'Egresos'
] as const

export function buildExportFileName(date = new Date()): string {
  return `export_rifa_${format(date, 'yyyy-MM-dd_HHmm')}.xlsx`
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const sheet = wb.addWorksheet(name.slice(0, 31))
  const header = sheet.addRow(headers)
  header.font = { bold: true }
  for (const row of rows) {
    sheet.addRow(row.map((v) => (v == null ? '' : v)))
  }
  sheet.columns.forEach((col) => {
    col.width = 16
  })
}

export async function exportFullWorkbook(input?: {
  from?: string
  to?: string
}): Promise<ApiResult<{ filePath: string; sheetCount: number }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'export:full')
    const prisma = getPrisma()

    const from = input?.from ? new Date(input.from) : undefined
    const to = input?.to ? new Date(input.to) : undefined
    const dateFilter = (field: 'paidAt' | 'soldAt' | 'settledAt' | 'expenseDate') =>
      from || to
        ? {
            [field]: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          }
        : {}

    const [tickets, buyers, sellers, payments, settlements, expenses, sales] =
      await Promise.all([
        prisma.ticket.findMany({
          include: { seller: true, buyer: true },
          orderBy: { number: 'asc' }
        }),
        prisma.buyer.findMany({ orderBy: { fullName: 'asc' } }),
        prisma.seller.findMany({ orderBy: { fullName: 'asc' } }),
        prisma.payment.findMany({
          where: { status: 'ACTIVO', ...dateFilter('paidAt') },
          include: {
            paymentMethod: true,
            user: true,
            ticket: { include: { seller: true, buyer: true } }
          },
          orderBy: { paidAt: 'desc' }
        }),
        prisma.settlement.findMany({
          where: { status: 'ACTIVO', ...dateFilter('settledAt') },
          include: { ticket: true, seller: true, user: true },
          orderBy: { settledAt: 'desc' }
        }),
        prisma.expense.findMany({
          where: { status: 'ACTIVO', ...dateFilter('expenseDate') },
          include: { paymentMethod: true, user: true },
          orderBy: { expenseDate: 'desc' }
        }),
        prisma.sale.findMany({
          where: { status: 'ACTIVO', ...dateFilter('soldAt') },
          include: { ticket: true, seller: true, buyer: true },
          orderBy: { soldAt: 'desc' }
        })
      ])

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Rifa Cafeteros del Quindío'
    wb.created = new Date()

    addSheet(wb, 'Boletas', [
      'Número',
      'Estado',
      'Liquidada',
      'Vendedor',
      'Comprador',
      'Valor',
      'Pagado',
      'Saldo',
      'Fecha venta'
    ], tickets.map((t) => [
      t.number,
      t.status,
      t.isSettled ? 'Sí' : 'No',
      t.seller?.fullName ?? '',
      t.buyer?.fullName ?? '',
      t.totalAmount,
      t.totalPaid,
      t.balanceDue,
      t.soldAt ? format(t.soldAt, 'yyyy-MM-dd HH:mm') : ''
    ]))

    addSheet(wb, 'Compradores', [
      'Nombre',
      'Documento',
      'Teléfono',
      'Dirección',
      'Email',
      'Notas'
    ], buyers.map((b) => [
      b.fullName,
      b.documentId,
      b.phone,
      b.address ?? '',
      b.email ?? '',
      b.notes ?? ''
    ]))

    addSheet(wb, 'Vendedores', [
      'Nombre',
      'Documento',
      'Teléfono',
      'Dirección',
      'Estado',
      'Notas'
    ], sellers.map((s) => [
      s.fullName,
      s.documentId,
      s.phone,
      s.address ?? '',
      s.status,
      s.notes ?? ''
    ]))

    addSheet(wb, 'Ventas', [
      'Boleta',
      'Fecha',
      'Vendedor',
      'Comprador',
      'Valor',
      'Pago inicial'
    ], sales.map((s) => [
      s.ticket.number,
      format(s.soldAt, 'yyyy-MM-dd HH:mm'),
      s.seller.fullName,
      s.buyer.fullName,
      s.amount,
      s.initialPayment
    ]))

    addSheet(wb, 'Pagos', [
      'Boleta',
      'Tipo',
      'Valor',
      'Fecha',
      'Método',
      'Vendedor',
      'Comprador',
      'Usuario',
      'Origen',
      'Notas'
    ], payments.map((p) => [
      p.ticket.number,
      p.type,
      p.amount,
      format(p.paidAt, 'yyyy-MM-dd HH:mm'),
      p.paymentMethod.name,
      p.ticket.seller?.fullName ?? '',
      p.ticket.buyer?.fullName ?? '',
      p.user.fullName,
      p.origin,
      p.notes ?? ''
    ]))

    addSheet(wb, 'Liquidaciones', [
      'Boleta',
      'Vendedor',
      'Valor',
      'Fecha',
      'Usuario',
      'Notas'
    ], settlements.map((s) => [
      s.ticket.number,
      s.seller.fullName,
      s.amount,
      format(s.settledAt, 'yyyy-MM-dd HH:mm'),
      s.user.fullName,
      s.notes ?? ''
    ]))

    addSheet(wb, 'Egresos', [
      'Fecha',
      'Concepto',
      'Categoría',
      'Valor',
      'Método',
      'Usuario',
      'Notas'
    ], expenses.map((e) => [
      format(e.expenseDate, 'yyyy-MM-dd'),
      e.concept,
      e.category,
      e.amount,
      e.paymentMethod?.name ?? '',
      e.user.fullName,
      e.notes ?? ''
    ]))

    // Security: never export users or password hashes.

    const win = BrowserWindow.getFocusedWindow()
    const saveOptions = {
      title: 'Exportar Excel',
      defaultPath: buildExportFileName(),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    }
    const save = win
      ? await dialog.showSaveDialog(win, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (save.canceled || !save.filePath) {
      return { ok: false, error: 'Exportación cancelada.' }
    }

    const buffer = await wb.xlsx.writeBuffer()
    await writeFile(save.filePath, Buffer.from(buffer))

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        module: 'EXPORT',
        action: 'EXCEL_EXPORTADO',
        entity: 'Workbook',
        entityId: save.filePath,
        newValue: JSON.stringify({
          filePath: save.filePath,
          sheetCount: wb.worksheets.length,
          from: input?.from ?? null,
          to: input?.to ?? null
        })
      }
    })

    return {
      ok: true,
      data: { filePath: save.filePath, sheetCount: wb.worksheets.length }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al exportar Excel'
    }
  }
}
