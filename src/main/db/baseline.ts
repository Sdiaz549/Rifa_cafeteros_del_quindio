import bcrypt from 'bcryptjs'
import { PaymentMethodStatus, RoleCode } from '@prisma/client'
import {
  APP_NAME,
  COMPANY_NAME,
  DEFAULT_TICKET_COUNT,
  DEFAULT_TICKET_PRICE,
  SETTING_KEYS
} from '../../shared/constants'
import { getPrisma } from './client'

const DEFAULT_PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Bancolombia', 'Transferencia']

/**
 * Creates the minimum data needed for a fresh install (roles, admin, settings, methods).
 * Safe to call on every startup — no-ops when users already exist.
 */
export async function ensureBaselineData(): Promise<void> {
  const prisma = getPrisma()
  const userCount = await prisma.user.count()
  if (userCount > 0) return

  console.log('[db] first run — creating baseline admin data')

  const adminRole = await prisma.role.upsert({
    where: { code: RoleCode.ADMIN },
    update: { name: 'Administrador' },
    create: { code: RoleCode.ADMIN, name: 'Administrador' }
  })

  await prisma.role.upsert({
    where: { code: RoleCode.USER },
    update: { name: 'Usuario' },
    create: { code: RoleCode.USER, name: 'Usuario' }
  })

  const passwordHash = await bcrypt.hash('Admin123!', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Administrador',
      passwordHash,
      roleId: adminRole.id,
      isActive: true
    },
    create: {
      username: 'admin',
      fullName: 'Administrador',
      passwordHash,
      roleId: adminRole.id,
      isActive: true
    }
  })

  for (const name of DEFAULT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: { status: PaymentMethodStatus.ACTIVO },
      create: { name, status: PaymentMethodStatus.ACTIVO }
    })
  }

  const settings: Record<string, string> = {
    [SETTING_KEYS.companyName]: COMPANY_NAME,
    [SETTING_KEYS.raffleName]: `${APP_NAME} ${COMPANY_NAME}`,
    [SETTING_KEYS.ticketCount]: String(DEFAULT_TICKET_COUNT),
    [SETTING_KEYS.defaultTicketPrice]: String(DEFAULT_TICKET_PRICE),
    [SETTING_KEYS.drawDate]: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    [SETTING_KEYS.backupFolder]: '',
    [SETTING_KEYS.autoBackupEnabled]: 'true',
    [SETTING_KEYS.autoBackupOnClose]: 'true',
    [SETTING_KEYS.ticketNumberPad]: '4'
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value, updatedByUserId: admin.id },
      create: { key, value, updatedByUserId: admin.id }
    })
  }
}
