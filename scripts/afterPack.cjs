const { cpSync, existsSync, mkdirSync, rmSync, mkdtempSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

/**
 * electron-builder ignores `.prisma` and may leave `@prisma/client` resolving
 * from inside app.asar, where `.prisma/client` is invisible.
 *
 * 1) Copy both packages into app.asar.unpacked/node_modules (native .node works).
 * 2) Also inject `.prisma` JS into the asar so any asar-side require still resolves.
 */
exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const resourcesDir = join(context.appOutDir, 'resources')
  const unpackModules = join(resourcesDir, 'app.asar.unpacked', 'node_modules')
  const asarPath = join(resourcesDir, 'app.asar')

  const prismaSrc = join(projectDir, 'node_modules', '.prisma')
  const clientSrc = join(projectDir, 'node_modules', '@prisma', 'client')

  for (const [src, dest] of [
    [prismaSrc, join(unpackModules, '.prisma')],
    [clientSrc, join(unpackModules, '@prisma', 'client')]
  ]) {
    if (!existsSync(src)) {
      throw new Error(`[afterPack] missing ${src} — run prisma generate first`)
    }
    mkdirSync(join(dest, '..'), { recursive: true })
    rmSync(dest, { recursive: true, force: true })
    cpSync(src, dest, { recursive: true })
    console.log(`[afterPack] copied ${src} → ${dest}`)
  }

  // Inject generated client into asar (JS + wasm). Keep .node only in unpacked.
  try {
    const asar = require('@electron/asar')
    const tmp = mkdtempSync(join(tmpdir(), 'rifa-asar-'))
    asar.extractAll(asarPath, tmp)
    const asarPrisma = join(tmp, 'node_modules', '.prisma')
    mkdirSync(join(asarPrisma, '..'), { recursive: true })
    rmSync(asarPrisma, { recursive: true, force: true })
    cpSync(prismaSrc, asarPrisma, { recursive: true })
    // Strip native binaries from asar copy — Electron cannot load .node from asar
    const { readdirSync, unlinkSync, statSync } = require('node:fs')
    const stripNode = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) stripNode(p)
        else if (name.endsWith('.node')) unlinkSync(p)
      }
    }
    stripNode(asarPrisma)
    rmSync(asarPath)
    await asar.createPackage(tmp, asarPath)
    rmSync(tmp, { recursive: true, force: true })
    console.log('[afterPack] injected .prisma into app.asar (without .node)')
  } catch (error) {
    console.warn('[afterPack] asar inject skipped:', error instanceof Error ? error.message : error)
  }
}
