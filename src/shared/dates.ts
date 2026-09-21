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

export function toIsoDate(date: Date): string {
  return date.toISOString()
}
