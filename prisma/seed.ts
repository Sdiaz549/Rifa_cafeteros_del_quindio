import {
  PrismaClient,
  RoleCode,
  TicketStatus,
  SellerStatus,
  PaymentMethodStatus,
  PaymentType,
  PaymentOrigin,
  RecordStatus,
  AssignmentReason
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
    ticketNumberPad: '4'
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value, updatedByUserId: admin.id },
      create: { key, value, updatedByUserId: admin.id }
    })
  }

  const sellerNames = [
    'Yolanda Muñoz',
    'Carlos Ramírez',
    'María López',
    'José Herrera',
    'Ana Gómez',
    'Pedro Sánchez',
    'Laura Martínez',
    'Diego Torres',
    'Sofía Vargas',
    'Andrés Ruiz'
  ]

  const sellers: { id: string }[] = []
  for (let i = 0; i < sellerNames.length; i++) {
    const documentId = `10000000${i}`
    const seller = await prisma.seller.upsert({
      where: { documentId },
      update: {
        fullName: sellerNames[i],
        phone: `30010000${i}`,
        status: SellerStatus.ACTIVO
      },
      create: {
        fullName: sellerNames[i],
        documentId,
        phone: `30010000${i}`,
        address: `Calle ${i + 1} # ${i}-10`,
        status: SellerStatus.ACTIVO
      }
    })
    sellers.push(seller)
  }

  const buyers: { id: string }[] = []
  for (let i = 1; i <= 50; i++) {
    const documentId = `20000000${String(i).padStart(2, '0')}`
    const buyer = await prisma.buyer.upsert({
      where: { documentId },
      update: {
        fullName: `Comprador Demo ${i}`,
        phone: `31020000${String(i).padStart(2, '0')}`
      },
      create: {
        fullName: `Comprador Demo ${i}`,
        documentId,
        phone: `31020000${String(i).padStart(2, '0')}`,
        address: `Carrera ${i} # ${i}-20`
      }
    })
    buyers.push(buyer)
  }

  const existing = await prisma.ticket.count()
  if (existing === 0) {
    await prisma.ticket.createMany({
      data: Array.from({ length: 100 }, (_, idx) => ({
        number: idx,
        status: TicketStatus.DISPONIBLE,
        sellerId: sellers[idx % sellers.length].id,
        totalAmount: 0,
        totalPaid: 0,
        balanceDue: 0,
        isSettled: false
      }))
    })

    for (const seller of sellers) {
      const assigned = await prisma.ticket.findMany({
        where: { sellerId: seller.id },
        select: { id: true }
      })
      if (assigned.length) {
        await prisma.ticketAssignment.createMany({
          data: assigned.map((t) => ({
            ticketId: t.id,
            sellerId: seller.id,
            assignedByUserId: admin.id,
            reason: AssignmentReason.ASIGNACION_INICIAL
          }))
        })
      }
    }

    const efectivo = await prisma.paymentMethod.findUniqueOrThrow({ where: { name: 'Efectivo' } })
    const nequi = await prisma.paymentMethod.findUniqueOrThrow({ where: { name: 'Nequi' } })
    const samples = await prisma.ticket.findMany({ orderBy: { number: 'asc' }, take: 40 })
    const price = DEFAULT_TICKET_PRICE

    for (let i = 0; i < samples.length; i++) {
      const ticket = samples[i]
      const buyer = buyers[i % buyers.length]
      const sellerId = ticket.sellerId!
      if (!sellerId) continue

      if (i < 10) {
        const paid = 20_000
        const sale = await prisma.sale.create({
          data: {
            ticketId: ticket.id,
            buyerId: buyer.id,
            sellerId,
            amount: price,
            soldAt: new Date(),
            initialPayment: paid,
            paymentMethodId: efectivo.id,
            createdByUserId: admin.id,
            status: RecordStatus.ACTIVO
          }
        })
        await prisma.payment.create({
          data: {
            ticketId: ticket.id,
            saleId: sale.id,
            type: PaymentType.VENTA_INICIAL,
            amount: paid,
            paidAt: new Date(),
            paymentMethodId: efectivo.id,
            userId: admin.id,
            origin: PaymentOrigin.MANUAL,
            status: RecordStatus.ACTIVO,
            sequence: 1
          }
        })
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.EN_ABONOS,
            buyerId: buyer.id,
            soldAt: new Date(),
            totalAmount: price,
            totalPaid: paid,
            balanceDue: price - paid
          }
        })
      } else if (i < 20) {
        const sale = await prisma.sale.create({
          data: {
            ticketId: ticket.id,
            buyerId: buyer.id,
            sellerId,
            amount: price,
            soldAt: new Date(),
            initialPayment: price,
            paymentMethodId: nequi.id,
            createdByUserId: admin.id,
            status: RecordStatus.ACTIVO
          }
        })
        await prisma.payment.create({
          data: {
            ticketId: ticket.id,
            saleId: sale.id,
            type: PaymentType.VENTA_INICIAL,
            amount: price,
            paidAt: new Date(),
            paymentMethodId: nequi.id,
            userId: admin.id,
            origin: PaymentOrigin.MANUAL,
            status: RecordStatus.ACTIVO,
            sequence: 1
          }
        })
        const settled = i < 15
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.CANCELADA,
            buyerId: buyer.id,
            soldAt: new Date(),
            totalAmount: price,
            totalPaid: price,
            balanceDue: 0,
            isSettled: settled,
            settledAt: settled ? new Date() : null
          }
        })
        if (settled) {
          await prisma.settlement.create({
            data: {
              ticketId: ticket.id,
              sellerId,
              amount: price,
              settledAt: new Date(),
              userId: admin.id,
              status: RecordStatus.ACTIVO
            }
          })
        }
      } else if (i < 25) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.PERDIDA,
            buyerId: buyer.id,
            soldAt: new Date(),
            totalAmount: price,
            totalPaid: 10_000,
            balanceDue: price - 10_000
          }
        })
      }
    }
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
