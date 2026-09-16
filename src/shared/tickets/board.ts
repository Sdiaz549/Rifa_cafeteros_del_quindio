import type { TicketStatus } from '../types'

export const BOARD_STATUSES = ['SIN_VENDER', 'EN_ABONOS', 'CANCELADA', 'PERDIDA'] as const

export function packTicketCell(status: TicketStatus, isSettled: boolean): number {
  const code = BOARD_STATUSES.indexOf(status)
  return (code < 0 ? 0 : code) | (isSettled ? 4 : 0)
}

export function unpackTicketCell(packed: number): { status: TicketStatus; isSettled: boolean } {
  return {
    status: BOARD_STATUSES[packed & 3] ?? 'SIN_VENDER',
    isSettled: (packed & 4) !== 0
  }
}

export function boardStatsFromPacked(packed: number[]): {
  total: number
  disponible: number
  enAbonos: number
  cancelada: number
  perdida: number
  liquidadas: number
  pendLiq: number
  vendidas: number
} {
  let disponible = 0
  let enAbonos = 0
  let cancelada = 0
  let perdida = 0
  let liquidadas = 0
  let pendLiq = 0
  for (const cell of packed) {
    const status = cell & 3
    if (status === 0) disponible += 1
    else if (status === 1) enAbonos += 1
    else if (status === 2) {
      cancelada += 1
      if (!(cell & 4)) pendLiq += 1
    } else perdida += 1
    if (cell & 4) liquidadas += 1
  }
  const total = packed.length
  return {
    total,
    disponible,
    enAbonos,
    cancelada,
    perdida,
    liquidadas,
    pendLiq,
    vendidas: total - disponible
  }
}
