/**
 * Builds the Windows NSIS installer outside OneDrive.
 * OneDrive locks `release/win-unpacked` during rename and electron-builder
 * fails with EPERM. Artifacts are copied back to ./release afterwards.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const projectRoot = process.cwd()
const localOut = join(homedir(), 'AppData', 'Local', 'SistemaRifas-dist')
const projectRelease = join(projectRoot, 'release')
const dirOnly = process.argv.includes('--dir')

mkdirSync(localOut, { recursive: true })
mkdirSync(projectRelease, { recursive: true })

for (const leftover of ['win-unpacked', 'win-unpacked.tmp']) {
  const p = join(projectRelease, leftover)
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
  }
}

const args = [
  'electron-builder',
  '--win',
  ...(dirOnly ? ['--dir'] : ['nsis']),
  `--config.directories.output=${localOut}`
]

const result = spawnSync('npx', args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
  }
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

for (const name of readdirSync(localOut)) {
  const src = join(localOut, name)
  if (statSync(src).isDirectory()) continue
  if (!/\.(exe|yml|blockmap|7z)$/i.test(name)) continue
  copyFileSync(src, join(projectRelease, name))
  console.log(`Copied ${name} -> release/`)
}
