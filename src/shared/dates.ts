import { format, parseISO, isValid } from 'date-fns'

/** Visual format for Colombia: DD/MM/YYYY */
export function formatDateCo(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(date)) return '—'
  return format(date, 'dd/MM/yyyy')
}

export function formatDateTimeCo(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(date)) return '—'
  return format(date, 'dd/MM/yyyy HH:mm')
}

/** Valor yyyy-MM-dd para <input type="date">, en hora local. */
export function todayInputDate(): string {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Convierte yyyy-MM-dd local a ISO, conservando la hora actual. */
export function inputDateToIso(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const now = new Date()
  const date = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())
  if (!isValid(date)) return undefined
  return date.toISOString()
}

export function toIsoDate(date: Date): string {
  return date.toISOString()
}
