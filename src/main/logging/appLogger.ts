import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { format } from 'date-fns'
import { getLogsPath } from '../paths'

const SENSITIVE = /password|passwordhash|passwd|token|secret|authorization|credential/i

function logFilePath(): string {
  const dir = getLogsPath()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, `app-${format(new Date(), 'yyyy-MM-dd')}.log`)
}

function redact(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'string') {
    if (SENSITIVE.test(value) && value.length > 8) return '[redacted]'
    return value
  }
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v)
    }
    return out
  }
  return value
}

function write(level: 'INFO' | 'ERROR' | 'WARN', event: string, extra?: unknown): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    extra: extra === undefined ? undefined : redact(extra)
  })
  try {
    appendFileSync(logFilePath(), `${line}\n`, 'utf8')
  } catch (error) {
    console.error('[log] write failed', error)
  }
  if (level === 'ERROR') console.error(`[${event}]`, extra)
  else if (level === 'WARN') console.warn(`[${event}]`, extra)
  else console.log(`[${event}]`, extra ?? '')
}

export function logInfo(event: string, extra?: unknown): void {
  write('INFO', event, extra)
}

export function logWarn(event: string, extra?: unknown): void {
  write('WARN', event, extra)
}

export function logError(event: string, extra?: unknown): void {
  write('ERROR', event, extra)
}

export function errorToLog(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack }
  }
  return { message: String(error) }
}
