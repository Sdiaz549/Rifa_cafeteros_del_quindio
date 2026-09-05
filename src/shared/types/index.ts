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

export interface CreateSettlementInput {
  ticketNumber: number
  settledAt?: string
  notes?: string
  amount?: number
}

export interface SettlementSummary {
  id: string
  ticketId: string
  ticketNumber: number
  sellerId: string
  sellerName: string
  amount: number
  settledAt: string
  userId: string
  userName: string
  notes: string | null
  status: RecordStatus
}

export interface UnsoldBySellerSummary {
  sellerId: string | null
  sellerName: string
  sellerStatus: SellerStatus | null
  ticketCount: number
  unsoldCount: number
  unsoldPercent: number
  tickets: TicketSummary[]
}

export interface IncomeSummary {
  id: string
  ticketNumber: number
  type: PaymentType
  amount: number
  paidAt: string
  paymentMethodName: string
  sellerName: string | null
  buyerName: string | null
  userName: string
  origin: PaymentOrigin
  notes: string | null
}

export interface IncomeListResult {
  items: IncomeSummary[]
  total: number
  totalAmount: number
  totalInitialSales: number
  totalInstallments: number
}

export interface ExpenseSummary {
  id: string
  expenseDate: string
  concept: string
  category: string
  amount: number
  paymentMethodId: string | null
  paymentMethodName: string | null
  notes: string | null
  userId: string
  userName: string
  status: RecordStatus
}

export interface CreateExpenseInput {
  expenseDate?: string
  concept: string
  category: string
  amount: number
  paymentMethodId?: string | null
  notes?: string | null
}

export interface ExpenseListResult {
  items: ExpenseSummary[]
  total: number
  totalAmount: number
}

export type ReportKind =
  | 'ingresos_por_dia'
  | 'ventas_por_vendedor'
  | 'recaudo_por_vendedor'
  | 'metodos_de_pago'
  | 'boletas_por_estado'
  | 'egresos_por_categoria'
  | 'pendientes_liquidacion'

export interface ReportRow {
  label: string
  value: number
  secondary?: number
  meta?: string
}

export interface ReportResult {
  kind: ReportKind
  title: string
  rows: ReportRow[]
  total: number
}

export type BackupTrigger = 'MANUAL' | 'ON_CLOSE' | 'SCHEDULED' | 'PRE_RESTORE'

export interface BackupSummary {
  id: string
  fileName: string
  filePath: string
  createdAt: string
  trigger: BackupTrigger
  createdByUserId: string | null
  createdByName: string | null
  sizeBytes: number
  notes: string | null
}

export interface BackupSettings {
  backupFolder: string
  autoBackupEnabled: boolean
  autoBackupOnClose: boolean
}

export interface AuditLogSummary {
  id: string
  createdAt: string
  userId: string | null
  userName: string | null
  module: string
  action: string
  entity: string
  entityId: string | null
  previousValue: string | null
  newValue: string | null
  origin: string
  notes: string | null
}

export interface AuditListResult {
  items: AuditLogSummary[]
  total: number
}
