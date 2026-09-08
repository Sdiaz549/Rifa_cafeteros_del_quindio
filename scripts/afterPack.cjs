const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

/**
 * electron-builder ignores `.prisma` and may leave `@prisma/client` resolving
 * from inside app.asar, where `.prisma/client` is invisible.
 *
 * We force both packages into app.asar.unpacked/node_modules so createRequire
 * from the unpacked client can resolve the generated client + engines.
 */
exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const unpackModules = join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules'
  )

  const copies = [
    {
      src: join(projectDir, 'node_modules', '.prisma'),
      dest: join(unpackModules, '.prisma')
    },
    {
      src: join(projectDir, 'node_modules', '@prisma', 'client'),
      dest: join(unpackModules, '@prisma', 'client')
    }
  ]

  for (const { src, dest } of copies) {
    if (!existsSync(src)) {
      throw new Error(`[afterPack] missing ${src} — run prisma generate first`)
    }
    mkdirSync(join(dest, '..'), { recursive: true })
    rmSync(dest, { recursive: true, force: true })
    cpSync(src, dest, { recursive: true })
    console.log(`[afterPack] copied ${src} → ${dest}`)
  }
}
