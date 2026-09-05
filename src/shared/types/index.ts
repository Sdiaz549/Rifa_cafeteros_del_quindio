import type { RoleCode } from '../permissions'

export type TicketStatus = 'DISPONIBLE' | 'EN_ABONOS' | 'CANCELADA' | 'PERDIDA'
export type SellerStatus = 'ACTIVO' | 'INACTIVO'
export type PaymentMethodStatus = 'ACTIVO' | 'INACTIVO'
export type PaymentType = 'VENTA_INICIAL' | 'ABONO'
export type PaymentOrigin = 'MANUAL' | 'VOZ'
export type RecordStatus = 'ACTIVO' | 'ANULADO'

export interface SessionUser {
  userId: string
  username: string
  fullName: string
  role: RoleCode
  startedAt: string
}

export interface TicketSummary {
  id: string
  number: number
  status: TicketStatus
  isSettled: boolean
  sellerId: string | null
  sellerName: string | null
  buyerId: string | null
  buyerName: string | null
  totalAmount: number
  totalPaid: number
  balanceDue: number
  soldAt: string | null
}

export interface ApiErrorShape {
  ok: false
  error: string
  code?: string
}

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export type ApiResult<T> = ApiSuccess<T> | ApiErrorShape
