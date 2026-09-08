import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * @prisma/client is CommonJS. In the packaged app it must load from
 * app.asar.unpacked so the sibling `.prisma/client` (engines + generated
 * client) resolves correctly.
 */
function loadPrismaClient(): typeof import('@prisma/client') {
  if (app.isPackaged) {
    const unpackedClientDir = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@prisma',
      'client'
    )
    const entry = join(unpackedClientDir, 'default.js')
    if (existsSync(entry)) {
      return createRequire(entry)(unpackedClientDir) as typeof import('@prisma/client')
    }
  }

  return createRequire(import.meta.url)('@prisma/client') as typeof import('@prisma/client')
}

const prismaClient = loadPrismaClient()

export const PrismaClient = prismaClient.PrismaClient
export const RoleCode = prismaClient.RoleCode
export const PaymentMethodStatus = prismaClient.PaymentMethodStatus
export type PrismaClientType = InstanceType<typeof prismaClient.PrismaClient>
