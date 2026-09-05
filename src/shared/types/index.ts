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

export interface BuyerSummary {
  id: string
  fullName: string
  documentId: string
  phone: string
  address: string | null
  email: string | null
  notes: string | null
  ticketsCount?: number
  balanceDue?: number
}

export interface SellerSummary {
  id: string
  fullName: string
  documentId: string
  phone: string
  address: string | null
  status: SellerStatus
  notes: string | null
  ticketsCount?: number
  availableCount?: number
  partialCount?: number
  paidCount?: number
  lostCount?: number
  settledCount?: number
  collectedTotal?: number
  pendingTotal?: number
}

export interface PaymentMethodSummary {
  id: string
  name: string
  status: PaymentMethodStatus
}

export interface PaymentSummary {
  id: string
  ticketId: string
  ticketNumber?: number
  type: PaymentType
  amount: number
  paidAt: string
  paymentMethodId: string
  paymentMethodName: string
  userId: string
  userName: string
  origin: PaymentOrigin
  notes: string | null
  sequence: number
  status: RecordStatus
}

export interface CreateSaleInput {
  ticketNumber: number
  sellerId: string
  buyerId?: string
  buyer?: {
    fullName: string
    documentId: string
    phone: string
    address?: string
    email?: string
  }
  amount: number
  initialPayment: number
  paymentMethodId: string
  soldAt?: string
  notes?: string
}

export interface CreatePaymentInput {
  ticketNumber: number
  amount: number
  paymentMethodId: string
  paidAt?: string
  notes?: string
  origin?: PaymentOrigin
}
