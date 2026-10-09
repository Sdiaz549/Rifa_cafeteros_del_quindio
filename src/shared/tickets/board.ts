import type { TicketStatus } from '../types'
import { parseTicketNumber } from './numbers'

export const BOARD_STATUSES = ['SIN_VENDER', 'EN_ABONOS', 'CANCELADA', 'PERDIDA', 'DAÑADA'] as const
const STATUS_MASK = 7
const SETTLED_BIT = 8

export function packTicketCell(status: TicketStatus, isSettled: boolean): number {
  const code = BOARD_STATUSES.indexOf(status)
  return (code < 0 ? 0 : code) | (isSettled ? SETTLED_BIT : 0)
}

export function unpackTicketCell(packed: number): { status: TicketStatus; isSettled: boolean } {
  return {
    status: BOARD_STATUSES[packed & STATUS_MASK] ?? 'SIN_VENDER',
    isSettled: (packed & SETTLED_BIT) !== 0
  }
}

export type TicketBoardFilter = TicketStatus | 'LIQUIDADA' | ''

const FILTER_CODE: Record<string, number> = {
  SIN_VENDER: 0,
  EN_ABONOS: 1,
  CANCELADA: 2,
  PERDIDA: 3,
  DAÑADA: 4
}

export function packedCellMatchesFilter(cell: number, filter: TicketBoardFilter): boolean {
  if (!filter) return true
  if (filter === 'LIQUIDADA') return (cell & SETTLED_BIT) !== 0
  const code = cell & STATUS_MASK
  if (filter === 'CANCELADA') return code === 2 && (cell & SETTLED_BIT) === 0
  return code === FILTER_CODE[filter]
}

/** Índices que cumplen el filtro, o null si se deben mostrar todas. */
export function boardFilterIndices(packed: number[], filter: TicketBoardFilter): number[] | null {
  if (!filter) return null
  const indices: number[] = []
  for (let i = 0; i < packed.length; i++) {
    if (packedCellMatchesFilter(packed[i], filter)) indices.push(i)
  }
  return indices.length === packed.length ? null : indices
}

/** Índice en el tablero de la boleta buscada, o null si no existe. */
export function boardIndexForQuery(first: number, count: number, query: string): number | null {
  const q = query.trim()
  if (!q || count <= 0) return null
  const exact = parseTicketNumber(q)
  if (exact == null) return null
  const i = exact - first
  return i >= 0 && i < count ? i : null
}

export function boardStatsFromPacked(packed: number[]): {
  total: number
  disponible: number
  enAbonos: number
  cancelada: number
  perdida: number
  danada: number
  liquidadas: number
  pendLiq: number
  vendidas: number
} {
  let disponible = 0
  let enAbonos = 0
  let cancelada = 0
  let perdida = 0
  let danada = 0
  let liquidadas = 0
  let pendLiq = 0
  for (const cell of packed) {
    const status = cell & STATUS_MASK
    if (status === 0) disponible += 1
    else if (status === 1) enAbonos += 1
    else if (status === 2) {
      cancelada += 1
      if (!(cell & SETTLED_BIT)) pendLiq += 1
    } else if (status === 3) perdida += 1
    else if (status === 4) danada += 1
    if (cell & SETTLED_BIT) liquidadas += 1
  }
  const total = packed.length
  return {
    total,
    disponible,
    enAbonos,
    cancelada,
    perdida,
    danada,
    liquidadas,
    pendLiq,
    vendidas: total - disponible - perdida - danada
  }
}
