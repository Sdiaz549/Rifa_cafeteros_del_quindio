const { existsSync } = require('node:fs')
const { join } = require('node:path')

/**
 * Smoke-check that a packaged Electron output has Prisma where the
 * installed Windows app expects it.
 *
 * Usage: node scripts/verify-packaged-prisma.cjs [path-to-win-unpacked]
 */
const root = process.argv[2] || join(process.cwd(), 'release', 'win-unpacked')
const unpack = join(root, 'resources', 'app.asar.unpacked', 'node_modules')

const required = [
  join(unpack, '.prisma', 'client', 'default.js'),
  join(unpack, '.prisma', 'client', 'index.js'),
  join(unpack, '.prisma', 'client', 'query_engine-windows.dll.node'),
  join(unpack, '@prisma', 'client', 'default.js'),
  join(unpack, '@prisma', 'client', 'index.js'),
  join(root, 'resources', 'prisma', 'init.sql'),
  join(root, 'resources', 'app.asar')
]

let failed = 0
for (const path of required) {
  const ok = existsSync(path)
  console.log(`${ok ? 'OK ' : 'MISS'} ${path}`)
  if (!ok) failed += 1
}

// Resolve like the packaged main process does
try {
  const { createRequire } = require('node:module')
  const entry = join(unpack, '@prisma', 'client', 'default.js')
  const req = createRequire(entry)
  const client = req(join(unpack, '@prisma', 'client'))
  if (!client.PrismaClient || !client.RoleCode) {
    console.log('MISS PrismaClient/RoleCode exports')
    failed += 1
  } else {
    console.log('OK  PrismaClient + RoleCode load from unpacked path')
  }
} catch (error) {
  console.log('MISS require unpacked @prisma/client:', error instanceof Error ? error.message : error)
  failed += 1
}

if (failed) {
  console.error(`\nverify-packaged-prisma: ${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nverify-packaged-prisma: all checks passed')
