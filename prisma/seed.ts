import {
  PrismaClient,
  RoleCode,
  TicketStatus,
  PaymentMethodStatus
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  APP_NAME,
  COMPANY_NAME,
  DEFAULT_TICKET_COUNT,
  DEFAULT_TICKET_PRICE
} from '../src/shared/constants'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding RIFA database…')

  const adminRole = await prisma.role.upsert({
    where: { code: RoleCode.ADMIN },
    update: { name: 'Administrador' },
    create: { code: RoleCode.ADMIN, name: 'Administrador' }
  })

  const userRole = await prisma.role.upsert({
    where: { code: RoleCode.USER },
    update: { name: 'Usuario' },
    create: { code: RoleCode.USER, name: 'Usuario' }
  })

  const adminHash = await bcrypt.hash('Admin123!', 12)
  const userHash = await bcrypt.hash('Usuario123!', 12)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Administrador Sistema',
      passwordHash: adminHash,
      roleId: adminRole.id,
      isActive: true
    },
    create: {
      username: 'admin',
      fullName: 'Administrador Sistema',
      passwordHash: adminHash,
      roleId: adminRole.id,
      isActive: true
    }
  })

  await prisma.user.upsert({
    where: { username: 'operador' },
    update: {
      fullName: 'Operador Demo',
      passwordHash: userHash,
      roleId: userRole.id,
      isActive: true
    },
    create: {
      username: 'operador',
      fullName: 'Operador Demo',
      passwordHash: userHash,
      roleId: userRole.id,
      isActive: true
    }
  })

  for (const name of ['Efectivo', 'Nequi', 'Daviplata', 'Bancolombia', 'Transferencia']) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: { status: PaymentMethodStatus.ACTIVO },
      create: { name, status: PaymentMethodStatus.ACTIVO }
    })
  }

  const settings: Record<string, string> = {
    companyName: COMPANY_NAME,
    raffleName: `${APP_NAME} ${COMPANY_NAME}`,
    ticketCount: String(DEFAULT_TICKET_COUNT),
    defaultTicketPrice: String(DEFAULT_TICKET_PRICE),
    drawDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    backupFolder: '',
    autoBackupEnabled: 'true',
    autoBackupOnClose: 'true',
    backupScheduledEnabled: 'false',
    backupIntervalHours: '24',
    allowSurplus: 'false',
    googleDriveConnected: 'false',
    ticketNumberPad: '4'
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value, updatedByUserId: admin.id },
      create: { key, value, updatedByUserId: admin.id }
    })
  }

  const existing = await prisma.ticket.count()
  if (existing === 0) {
    await prisma.ticket.createMany({
      data: Array.from({ length: 100 }, (_, idx) => ({
        number: idx,
        status: TicketStatus.SIN_VENDER,
        totalAmount: 0,
        totalPaid: 0,
        balanceDue: 0,
        isSettled: false
      }))
    })
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      module: 'SYSTEM',
      action: 'SEED',
      entity: 'Database',
      origin: 'SYSTEM',
      notes: 'Seed de desarrollo aplicado'
    }
  })

  console.log('Seed OK')
  console.log('Admin: admin / Admin123! (solo desarrollo)')
  console.log('Usuario: operador / Usuario123! (solo desarrollo)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
