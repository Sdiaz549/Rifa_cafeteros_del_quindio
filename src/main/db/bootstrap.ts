import { getPrisma } from './client'
import { hashPassword } from '../auth/password'
import {
  COMPANY_NAME,
  APP_NAME,
  DEFAULT_TICKET_COUNT,
  DEFAULT_TICKET_PRICE,
  SETTING_KEYS
} from '../../shared/constants'
import { logInfo } from '../logging/appLogger'

const DEFAULT_PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Bancolombia', 'Transferencia']

/**
 * Datos mínimos para que el sistema arranque.
 * No pisa catálogos del cliente: solo inserta lo que falte.
 */
export async function ensureRequiredData(): Promise<void> {
  const prisma = getPrisma()

  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Administrador' },
    create: { code: 'ADMIN', name: 'Administrador' }
  })
  await prisma.role.upsert({
    where: { code: 'USER' },
    update: { name: 'Usuario' },
    create: { code: 'USER', name: 'Usuario' }
  })

  for (const name of DEFAULT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: {},
      create: { name, status: 'ACTIVO' }
    })
  }

  const defaults: Record<string, string> = {
    [SETTING_KEYS.companyName]: COMPANY_NAME,
    [SETTING_KEYS.raffleName]: `${APP_NAME} ${COMPANY_NAME}`,
    [SETTING_KEYS.ticketCount]: String(DEFAULT_TICKET_COUNT),
    [SETTING_KEYS.defaultTicketPrice]: String(DEFAULT_TICKET_PRICE),
    [SETTING_KEYS.autoBackupEnabled]: 'true',
    [SETTING_KEYS.autoBackupOnClose]: 'true',
    [SETTING_KEYS.backupScheduledEnabled]: 'false',
    [SETTING_KEYS.backupIntervalHours]: '24',
    [SETTING_KEYS.allowSurplus]: 'false',
    [SETTING_KEYS.googleDriveConnected]: 'false',
    [SETTING_KEYS.ticketNumberPad]: '4'
  }

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await prisma.setting.findUnique({ where: { key } })
    if (!existing) {
      await prisma.setting.create({ data: { key, value } })
    }
  }

  const userCount = await prisma.user.count()
  if (userCount === 0) {
    const passwordHash = await hashPassword('Admin123!')
    await prisma.user.create({
      data: {
        username: 'admin',
        fullName: 'Administrador',
        passwordHash,
        roleId: adminRole.id,
        isActive: true
      }
    })
    logInfo('db.bootstrap.adminCreated', { username: 'admin' })
  }

  await clearSeedTicketAssignments()
}

/** El seed inicial marcó boletas 0–100 como asignadas; solo se quitan esas, no las que sí asignaron después. */
async function clearSeedTicketAssignments(): Promise<void> {
  const prisma = getPrisma()
  const flagKey = 'clearedDemoTicketAssignments'
  const flag = await prisma.setting.findUnique({ where: { key: flagKey } })
  if (flag?.value === 'true') return

  const endedAt = new Date()
  const seedAssignments = await prisma.ticketAssignment.findMany({
    where: {
      endedAt: null,
      reason: 'ASIGNACION_INICIAL',
      ticket: { number: { lte: 100 } }
    },
    select: { id: true, ticketId: true }
  })

  if (seedAssignments.length > 0) {
    const ticketIds = [...new Set(seedAssignments.map((a) => a.ticketId))]
    await prisma.$transaction([
      prisma.ticketAssignment.updateMany({
        where: { id: { in: seedAssignments.map((a) => a.id) } },
        data: { endedAt }
      }),
      prisma.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { sellerId: null }
      })
    ])
    logInfo('db.bootstrap.clearedSeedAssignments', { count: seedAssignments.length })
  }

  await prisma.setting.upsert({
    where: { key: flagKey },
    update: { value: 'true' },
    create: { key: flagKey, value: 'true' }
  })
}
