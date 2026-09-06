import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { assertPermission } from '../../shared/permissions'
import { SETTING_KEYS, DEFAULT_TICKET_PRICE } from '../../shared/constants'
import { writeAuditLog } from '../audit/auditService'
import type { ApiResult, AppSettings, PublicSettings } from '../../shared/types'

const updateSchema = z.object({
  companyName: z.string().trim().min(2).optional(),
  raffleName: z.string().trim().min(2).optional(),
  ticketCount: z.number().int().min(1).max(500_000).optional(),
  defaultTicketPrice: z.number().int().min(0).optional(),
  drawDate: z.string().min(4).optional(),
  ticketNumberPad: z.number().int().min(2).max(8).optional(),
  generateMissingTickets: z.boolean().optional()
})

async function readSetting(key: string, fallback: string): Promise<string> {
  const row = await getPrisma().setting.findUnique({ where: { key } })
  return row?.value ?? fallback
}

async function writeSetting(key: string, value: string, userId?: string): Promise<void> {
  await getPrisma().setting.upsert({
    where: { key },
    create: { key, value, updatedByUserId: userId ?? null },
    update: { value, updatedByUserId: userId ?? null }
  })
}

function asBool(value: string): boolean {
  return value === 'true' || value === '1'
}

export async function getPublicSettings(): Promise<ApiResult<PublicSettings>> {
  try {
    requireSession()
    const [companyName, raffleName, drawDate, ticketCount, ticketNumberPad] =
      await Promise.all([
        readSetting(SETTING_KEYS.companyName, 'Cafeteros del Quindío'),
        readSetting(SETTING_KEYS.raffleName, 'RIFA Cafeteros del Quindío'),
        readSetting(SETTING_KEYS.drawDate, ''),
        readSetting(SETTING_KEYS.ticketCount, '10000'),
        readSetting(SETTING_KEYS.ticketNumberPad, '4')
      ])
    return {
      ok: true,
      data: {
        companyName,
        raffleName,
        drawDate,
        defaultTicketPrice: DEFAULT_TICKET_PRICE,
        ticketCount: Number(ticketCount) || 0,
        ticketNumberPad: Number(ticketNumberPad) || 4
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al leer configuración' }
  }
}

export async function getAppSettings(): Promise<ApiResult<AppSettings>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'settings:manage')
    const publicRes = await getPublicSettings()
    if (!publicRes.ok) return publicRes
    const [backupFolder, autoBackupEnabled, autoBackupOnClose] = await Promise.all([
      readSetting(SETTING_KEYS.backupFolder, ''),
      readSetting(SETTING_KEYS.autoBackupEnabled, 'true'),
      readSetting(SETTING_KEYS.autoBackupOnClose, 'true')
    ])
    return {
      ok: true,
      data: {
        ...publicRes.data,
        backupFolder,
        autoBackupEnabled: asBool(autoBackupEnabled),
        autoBackupOnClose: asBool(autoBackupOnClose)
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al leer configuración' }
  }
}

export async function updateAppSettings(raw: unknown): Promise<ApiResult<AppSettings>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'settings:manage')
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const data = parsed.data
    const prisma = getPrisma()

    if (data.companyName != null) await writeSetting(SETTING_KEYS.companyName, data.companyName, session.userId)
    if (data.raffleName != null) await writeSetting(SETTING_KEYS.raffleName, data.raffleName, session.userId)
    if (data.ticketCount != null)
      await writeSetting(SETTING_KEYS.ticketCount, String(data.ticketCount), session.userId)
    await writeSetting(SETTING_KEYS.defaultTicketPrice, String(DEFAULT_TICKET_PRICE), session.userId)
    if (data.drawDate != null) await writeSetting(SETTING_KEYS.drawDate, data.drawDate, session.userId)
    if (data.ticketNumberPad != null)
      await writeSetting(SETTING_KEYS.ticketNumberPad, String(data.ticketNumberPad), session.userId)

    let generated = 0
    if (data.generateMissingTickets && data.ticketCount) {
      const existing = await prisma.ticket.findMany({ select: { number: true } })
      const have = new Set(existing.map((t) => t.number))
      const missing: { number: number }[] = []
      for (let n = 0; n < data.ticketCount; n++) {
        if (!have.has(n)) missing.push({ number: n })
      }
      const chunk = 500
      for (let i = 0; i < missing.length; i += chunk) {
        await prisma.ticket.createMany({ data: missing.slice(i, i + chunk) })
      }
      generated = missing.length
    }

    await writeAuditLog({
      userId: session.userId,
      module: 'CONFIGURACION',
      action: 'CONFIGURACION_ACTUALIZADA',
      entity: 'Setting',
      newValue: { ...data, generatedTickets: generated }
    })

    return getAppSettings()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al guardar configuración' }
  }
}
