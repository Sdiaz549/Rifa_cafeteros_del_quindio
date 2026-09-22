import type { RoleCode } from '../permissions'

export type TicketStatus = 'SIN_VENDER' | 'EN_ABONOS' | 'CANCELADA' | 'PERDIDA'
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

/** Tablero compacto: packed[i] = boleta (first + i). 2 bits estado + 1 bit liquidada. */
export interface TicketBoardSnapshot {
  first: number
  packed: number[]
}

export type TicketBoardLiveUpdate =
  | { type: 'full' }
  | { type: 'cell'; number: number; status: TicketStatus; isSettled: boolean }

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

export interface BuyerTicketSummary {
  number: number
  status: TicketStatus
  totalPaid: number
  balanceDue: number
  payments: Array<{
    id: string
    amount: number
    paidAt: string
    type: string
    paymentMethodName: string
    notes: string | null
  }>
}

export interface BuyerSummary {
  id: string
  fullName: string
  documentId: string
  phone: string
  address: string | null
  email: string | null
  notes: string | null
  ticketsCount?: number
  ticketNumbers?: number[]
  balanceDue?: number
  totalPaid?: number
  tickets?: BuyerTicketSummary[]
}

export interface SellerTicketSummary {
  number: number
  status: TicketStatus
  isSettled: boolean
  totalPaid: number
  balanceDue: number
  buyerName: string | null
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
  ticketNumbers?: number[]
  tickets?: SellerTicketSummary[]
}

export interface AssignTicketInput {
  ticketNumber: number
  sellerId?: string
  seller?: {
    fullName: string
    documentId?: string
    phone?: string
    address?: string
  }
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
    documentId?: string
    phone?: string
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

export type BackupTrigger = 'MANUAL' | 'ON_CLOSE' | 'SCHEDULED' | 'INTERVAL' | 'PRE_RESTORE' | 'PRE_MIGRATE'

export interface AppRuntimeInfo {
  version: string
  name: string
  packaged: boolean
}

export type BackupStatus = 'LOCAL' | 'PENDING_DRIVE' | 'UPLOADED' | 'ERROR'
export type DriveBackupStatusLabel = 'UPLOADED' | 'PENDING' | 'ERROR'

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
  status: BackupStatus
  uploadedToDrive: boolean
  driveFileId: string | null
  driveUploadedAt: string | null
  errorMessage: string | null
}

export interface BackupSettings {
  backupFolder: string
  autoBackupEnabled: boolean
  autoBackupOnClose: boolean
  backupScheduledEnabled: boolean
  backupIntervalHours: number
  allowSurplus: boolean
}

export interface DashboardBackupCard {
  lastBackupAt: string | null
  status: DriveBackupStatusLabel
  statusLabel: string
  localPath: string | null
  uploadedToDrive: boolean
  driveFileId: string | null
  fileName: string | null
}

export interface GoogleDriveStatus {
  configured: boolean
  connected: boolean
  accountEmail: string | null
  folderId: string | null
  lastError: string | null
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

export interface UserSummary {
  id: string
  username: string
  fullName: string
  role: RoleCode
  roleName: string
  isActive: boolean
  createdAt: string
}

export interface AppSettings {
  companyName: string
  raffleName: string
  ticketCount: number
  defaultTicketPrice: number
  drawDate: string
  ticketNumberPad: number
  backupFolder: string
  autoBackupEnabled: boolean
  autoBackupOnClose: boolean
  backupScheduledEnabled: boolean
  backupIntervalHours: number
  allowSurplus: boolean
}

export interface PublicSettings {
  companyName: string
  raffleName: string
  drawDate: string
  defaultTicketPrice: number
  ticketCount: number
  ticketNumberPad: number
}

export interface ChartPoint {
  label: string
  value: number
}

export interface HomeSaleRow {
  id: string
  soldAt: string
  ticketNumber: number
  buyerName: string
  sellerName: string
  amount: number
  status: TicketStatus
}

export interface HomePaymentRow {
  id: string
  paidAt: string
  ticketNumber: number
  buyerName: string
  amount: number
  paymentMethodName: string
}

export interface HomeTicketStats {
  total: number
  vendidas: number
  disponible: number
  sinVender: number
  enAbonos: number
  cancelada: number
  perdida: number
  liquidadas: number
}

export interface HomeFinance {
  ingresosHoy: number
  ingresosHoyDeltaPct: number | null
  ingresosMes: number
  ingresosMesDeltaPct: number | null
  egresosMes: number
  balanceMes: number
  recaudado: number
  porCobrar: number
}

export interface HomeOverview {
  raffleName: string
  companyName: string
  finance: HomeFinance | null
  tickets: HomeTicketStats
  sellerCount: number
  buyerCount: number
  backup: DashboardBackupCard | null
  charts: {
    ingresos7Dias: ChartPoint[]
    estadosBoletas: ChartPoint[]
    topVendedores: ChartPoint[]
  }
  recentSales: HomeSaleRow[]
  recentPayments: HomePaymentRow[]
}

export interface DashboardSnapshot {
  ingresosDia: number
  ingresosMes: number
  ingresosPeriodo: number
  egresosTotal: number
  egresosPeriodo: number
  balance: number
  recaudado: number
  porCobrar: number
  total: number
  vendidas: number
  disponible: number
  sinVender: number
  enAbonos: number
  cancelada: number
  perdida: number
  liquidadas: number
  pendienteLiquidacion: number
  sellerCount: number
  buyerCount: number
  periodFrom: string
  periodTo: string
  charts: {
    ingresosPorDia: ChartPoint[]
    estadosBoletas: ChartPoint[]
    metodosPago: ChartPoint[]
  }
}
