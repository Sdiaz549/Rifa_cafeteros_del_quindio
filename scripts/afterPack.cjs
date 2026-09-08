const { cpSync, existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

/**
 * electron-builder ignores dotfolders (`.prisma`) by default.
 * Copy generated Prisma client + engines into the unpacked app.
 */
exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const appOutDir = context.appOutDir
  const src = join(projectDir, 'node_modules', '.prisma')
  const dest = join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '.prisma')

  if (!existsSync(src)) {
    throw new Error(`[afterPack] missing ${src} — run prisma generate first`)
  }

  mkdirSync(join(dest, '..'), { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[afterPack] copied Prisma client → ${dest}`)
}
