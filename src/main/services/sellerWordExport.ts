import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, shell } from 'electron'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { logError, logInfo, errorToLog } from '../logging/appLogger'
import type { ApiResult } from '../../shared/types'
import { buildSellerPaymentsDocx, buildSellerTicketsDocx } from './sellerDocx'

function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim()
  return (cleaned || 'vendedor').slice(0, 60)
}

function uniqueDownloadPath(base: string): string {
  const folder = app.getPath('downloads')
  let filePath = join(folder, `${base}.docx`)
  let n = 1
  while (existsSync(filePath)) {
    filePath = join(folder, `${base}_${n}.docx`)
    n += 1
  }
  return filePath
}

async function writeAndOpen(filePath: string, data: Buffer): Promise<void> {
  await writeFile(filePath, data)
  void shell.openPath(filePath)
}

export async function exportSellerTicketsWord(
  sellerId: string
): Promise<ApiResult<{ filePath: string }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'sellers:manage')
    const prisma = getPrisma()
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, fullName: true }
    })
    if (!seller) {
      return { ok: false, error: 'Vendedor no encontrado.' }
    }
    const tickets = await prisma.ticket.findMany({
      where: { sellerId },
      select: { number: true },
      orderBy: { number: 'asc' }
    })
    const numbers = tickets.map((t) => t.number)
    if (numbers.length === 0) {
      return { ok: false, error: 'Este vendedor no tiene boletas para exportar.' }
    }

    const filePath = uniqueDownloadPath(`Boletas_${safeFileName(seller.fullName)}`)
    await writeAndOpen(filePath, buildSellerTicketsDocx(seller.fullName, numbers))
    logInfo('sellers.exportWord.ok', { sellerId, filePath, count: numbers.length })

    return { ok: true, data: { filePath } }
  } catch (e) {
    logError('sellers.exportWord.fail', errorToLog(e))
    return { ok: false, error: e instanceof Error ? e.message : 'Error al exportar a Word' }
  }
}

export async function exportSellerPaymentsWord(
  sellerId: string
): Promise<ApiResult<{ filePath: string }>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'sellers:manage')
    const prisma = getPrisma()
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, fullName: true }
    })
    if (!seller) {
      return { ok: false, error: 'Vendedor no encontrado.' }
    }
    const tickets = await prisma.ticket.findMany({
      where: { sellerId },
      select: { number: true, totalPaid: true },
      orderBy: { number: 'asc' }
    })
    if (tickets.length === 0) {
      return { ok: false, error: 'Este vendedor no tiene boletas para exportar.' }
    }

    const filePath = uniqueDownloadPath(`Relacion_pagos_${safeFileName(seller.fullName)}`)
    await writeAndOpen(filePath, buildSellerPaymentsDocx(seller.fullName, tickets))
    logInfo('sellers.exportPayments.ok', { sellerId, filePath, count: tickets.length })

    return { ok: true, data: { filePath } }
  } catch (e) {
    logError('sellers.exportPayments.fail', errorToLog(e))
    return { ok: false, error: e instanceof Error ? e.message : 'Error al exportar la relación de pagos' }
  }
}
