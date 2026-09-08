import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

function engineFileName(): string {
  if (process.platform === 'win32') return 'query_engine-windows.dll.node'
  if (process.platform === 'darwin') {
    return process.arch === 'arm64'
      ? 'libquery_engine-darwin-arm64.dylib.node'
      : 'libquery_engine-darwin.dylib.node'
  }
  return 'libquery_engine-debian-openssl-3.0.x.so.node'
}

/**
 * @prisma/client is CommonJS. In the packaged app it must load from
 * app.asar.unpacked so the sibling `.prisma/client` (engines + generated
 * client) resolves correctly.
 */
function loadPrismaClient(): typeof import('@prisma/client') {
  const packaged = Boolean(app?.isPackaged)
  if (packaged) {
    const unpackedModules = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    const unpackedClientDir = join(unpackedModules, '@prisma', 'client')
    const entry = join(unpackedClientDir, 'default.js')
    const engine = join(unpackedModules, '.prisma', 'client', engineFileName())

    if (existsSync(engine)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine
    }

    if (existsSync(entry)) {
      return createRequire(entry)(unpackedClientDir) as typeof import('@prisma/client')
    }

    throw new Error(
      `Prisma empaquetado incompleto. Falta ${entry}. Reinstala la aplicación (v0.1.3+).`
    )
  }

  return createRequire(import.meta.url)('@prisma/client') as typeof import('@prisma/client')
}

const prismaClient = loadPrismaClient()

export const PrismaClient = prismaClient.PrismaClient
export const RoleCode = prismaClient.RoleCode
export const PaymentMethodStatus = prismaClient.PaymentMethodStatus
export type PrismaClientType = InstanceType<typeof prismaClient.PrismaClient>
