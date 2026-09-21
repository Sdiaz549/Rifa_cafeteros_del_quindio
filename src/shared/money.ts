/** Money stored as integer Colombian pesos (COP). */

export function formatCop(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.trunc(amount) : 0
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safe)
  return `$ ${formatted}`
}

export function parseCopInput(raw: string): number {
  const digits = raw.replace(/[^\d-]/g, '')
  if (!digits || digits === '-') return 0
  return Math.trunc(Number(digits))
}

export function assertNonNegativeMoney(amount: number, label = 'valor'): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`El ${label} debe ser un entero no negativo en pesos.`)
  }
}
