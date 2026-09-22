import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, dialog } from 'electron'
import type { ApiResult } from '../../shared/types'
import { getConfigPath } from '../paths'
import { logError, logInfo } from '../logging/appLogger'

let child: ChildProcess | null = null

function systemRoot(): string {
  return process.env.SystemRoot ?? 'C:\\Windows'
}

function cscPath(): string {
  const root = systemRoot()
  const x64 = join(root, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
  if (existsSync(x64)) return x64
  return join(root, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
}

function frameworkDir(): string {
  return dirname(cscPath())
}

function winmd(name: string): string {
  return join(systemRoot(), 'System32', 'WinMetadata', name)
}

function helperSourcePath(): string {
  const candidates = [
    join(process.cwd(), 'resources', 'windows-listen.cs'),
    join(app.getAppPath(), 'resources', 'windows-listen.cs'),
    join(process.resourcesPath, 'windows-listen.cs'),
    join(__dirname, 'windows-listen.cs')
  ]
  return candidates.find((p) => existsSync(p)) ?? candidates[0]
}

function helperPaths(): { dir: string; cs: string; exe: string } {
  const dir = getConfigPath()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return {
    dir,
    cs: join(dir, 'windows-listen.cs'),
    exe: join(dir, 'windows-listen.exe')
  }
}

function ensureHelper(): string {
  const sourcePath = helperSourcePath()
  if (!existsSync(sourcePath)) {
    throw new Error('NO_ENGINE')
  }
  const source = readFileSync(sourcePath, 'utf8')
  const { cs, exe } = helperPaths()
  const previous = existsSync(cs) ? readFileSync(cs, 'utf8') : ''
  if (previous !== source || !existsSync(exe)) {
    writeFileSync(cs, source, 'utf8')
    const fx = frameworkDir()
    const compiler = cscPath()
    if (!existsSync(compiler)) {
      throw new Error('NO_ENGINE')
    }
    const compiled = spawnSync(
      compiler,
      [
        '/nologo',
        '/target:exe',
        `/out:${exe}`,
        `/r:${join(fx, 'mscorlib.dll')}`,
        `/r:${join(fx, 'System.dll')}`,
        `/r:${join(fx, 'System.Runtime.dll')}`,
        `/r:${winmd('Windows.Foundation.winmd')}`,
        `/r:${winmd('Windows.Globalization.winmd')}`,
        `/r:${winmd('Windows.Media.winmd')}`,
        `/r:${winmd('Windows.Storage.winmd')}`,
        cs
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    if (compiled.status !== 0 || !existsSync(exe)) {
      logError('voice.listen.compile', {
        status: compiled.status,
        stdout: (compiled.stdout ?? '').slice(0, 500),
        stderr: (compiled.stderr ?? '').slice(0, 500)
      })
      throw new Error('NO_ENGINE')
    }
    logInfo('voice.listen.compiled')
  }
  return exe
}

function mapError(code: string): string {
  switch (code) {
    case 'NO_ENGINE':
      return 'Windows no tiene reconocimiento de voz. En Configuración → Hora e idioma → Voz, instale el idioma Español.'
    case 'NO_MIC':
      return 'No se detectó micrófono. Conéctelo y permita el acceso en Configuración → Privacidad → Micrófono.'
    case 'PRIVACY':
      return 'Windows necesita el reconocimiento de voz en español. Actívelo en Configuración → Privacidad → Voz.'
    case 'NO_SPEECH':
      return 'No se escuchó nada. Hable cerca del micrófono e intente de nuevo.'
    case 'CANCELLED':
      return ''
    default:
      return 'No se pudo escuchar. Revise el micrófono.'
  }
}

export function warmupWindowsSpeech(): void {
  try {
    ensureHelper()
  } catch (error) {
    logError('voice.listen.warmup', error)
  }
}

export function cancelWindowsListen(): void {
  if (!child) return
  child.kill()
  child = null
}

type ListenRaw =
  | { ok: true; transcript: string }
  | { ok: false; code: string }

async function offerSpeechPrivacy(): Promise<boolean> {
  const choice = await dialog.showMessageBox({
    type: 'info',
    title: 'Reconocimiento de voz',
    message: 'Para entender cualquier frase en español, Windows debe activar el reconocimiento de voz.',
    detail:
      'Así puede decir cosas como “haz el abono a estas boletas” o “buscar la boleta veinticinco”. Puede desactivarlo después en Configuración de Windows.',
    buttons: ['Activar y continuar', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (choice.response !== 0) return false
  const added = spawnSync(
    'reg',
    [
      'add',
      'HKCU\\Software\\Microsoft\\Speech_OneCore\\Settings',
      '/v',
      'OnlineSpeechPrivacy',
      '/t',
      'REG_DWORD',
      '/d',
      '1',
      '/f'
    ],
    { windowsHide: true, encoding: 'utf8' }
  )
  logInfo('voice.privacy.enabled', { status: added.status })
  return added.status === 0
}

function spawnListen(): Promise<ListenRaw> {
  cancelWindowsListen()
  logInfo('voice.listen.start')

  let exe: string
  try {
    exe = ensureHelper()
  } catch (error) {
    logError('voice.listen.helper', error)
    return Promise.resolve({ ok: false, code: 'NO_ENGINE' })
  }

  return new Promise((resolve) => {
    const proc = spawn(exe, [], {
      cwd: helperPaths().dir,
      windowsHide: true
    })
    child = proc
    let stdout = ''
    let stderr = ''
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    proc.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    proc.on('error', (spawnError) => {
      if (child === proc) child = null
      logError('voice.listen.spawn', spawnError)
      resolve({ ok: false, code: 'NO_ENGINE' })
    })
    proc.on('close', (code) => {
      const wasCurrent = child === proc
      if (wasCurrent) child = null
      const line = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s.startsWith('RIFA_VOICE:'))
      if (!line) {
        if (!wasCurrent || code == null) {
          resolve({ ok: false, code: 'CANCELLED' })
          return
        }
        logError('voice.listen.empty', { code, stderr: stderr.slice(0, 400) })
        resolve({ ok: false, code: 'NO_ENGINE' })
        return
      }
      try {
        const payload = JSON.parse(line.slice('RIFA_VOICE:'.length)) as {
          ok?: boolean
          text?: string
          error?: string
        }
        if (payload.ok && payload.text) {
          logInfo('voice.listen.ok', { text: payload.text, stderr: stderr.slice(0, 500) })
          resolve({ ok: true, transcript: payload.text })
          return
        }
        resolve({ ok: false, code: payload.error ?? 'NO_SPEECH' })
      } catch (parseError) {
        logError('voice.listen.parse', parseError)
        resolve({ ok: false, code: 'NO_ENGINE' })
      }
    })
  })
}

export async function listenWindowsSpeech(): Promise<ApiResult<{ transcript: string }>> {
  let result = await spawnListen()
  if (!result.ok && result.code === 'PRIVACY') {
    const enabled = await offerSpeechPrivacy()
    if (enabled) result = await spawnListen()
  }
  if (result.ok) return { ok: true, data: { transcript: result.transcript } }
  return { ok: false, error: mapError(result.code) }
}
