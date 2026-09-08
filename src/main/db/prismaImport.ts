import { createRequire } from 'node:module'

/**
 * @prisma/client is CommonJS. Named ESM imports break in the packaged Electron
 * main process ("Named export 'X' not found"). Use require() instead.
 */
const require = createRequire(import.meta.url)
const prismaClient = require('@prisma/client') as typeof import('@prisma/client')

export const PrismaClient = prismaClient.PrismaClient
export const RoleCode = prismaClient.RoleCode
export const PaymentMethodStatus = prismaClient.PaymentMethodStatus
export type PrismaClientType = InstanceType<typeof prismaClient.PrismaClient>
