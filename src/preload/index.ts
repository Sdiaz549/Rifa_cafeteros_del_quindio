import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, IPC_EVENTS } from '../shared/ipc/channels'
import type {
  ApiResult,
  AuditListResult,
  AppSettings,
  AuditLogSummary,
  BackupSettings,
  BackupSummary,
  BuyerSummary,
  CreateExpenseInput,
  CreatePaymentInput,
  CreateSaleInput,
  CreateSettlementInput,
  UpdatePaymentInput,
  DashboardBackupCard,
  DashboardSnapshot,
  GoogleDriveStatus,
  HomeOverview,
  AppRuntimeInfo,
  ExpenseListResult,
  ExpenseSummary,
  IncomeListResult,
  PaymentMethodSummary,
  PaymentSummary,
  PublicSettings,
  ReportKind,
  ReportResult,
  SellerSummary,
  SessionUser,
  SettlementSummary,
  TicketSummary,
  TicketBoardLiveUpdate,
  TicketBoardSnapshot,
  UnsoldBySellerSummary,
  UserSummary
} from '../shared/types'

const api = {
  auth: {
    login: (payload: { username: string; password: string }): Promise<ApiResult<SessionUser>> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload),
    logout: (): Promise<ApiResult<{ loggedOut: true }>> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    me: (): Promise<ApiResult<SessionUser>> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_ME)
  },
  tickets: {
    list: (payload?: {
      query?: string
      status?: string
      isSettled?: boolean
      sellerId?: string
      take?: number
      skip?: number
    }): Promise<ApiResult<{ items: TicketSummary[]; total: number }>> =>
      ipcRenderer.invoke('tickets:list', payload),
    board: (): Promise<ApiResult<TicketBoardSnapshot>> => ipcRenderer.invoke('tickets:board'),
    onBoardUpdated: (callback: (payload: TicketBoardLiveUpdate) => void): (() => void) => {
      const listener = (_event: unknown, payload: TicketBoardLiveUpdate) => callback(payload)
      ipcRenderer.on(IPC_EVENTS.TICKETS_BOARD_UPDATED, listener)
      return () => ipcRenderer.removeListener(IPC_EVENTS.TICKETS_BOARD_UPDATED, listener)
    },
    getByNumber: (number: number) => ipcRenderer.invoke('tickets:getByNumber', number),
    stats: () => ipcRenderer.invoke('tickets:stats'),
    markLost: (number: number): Promise<ApiResult<TicketSummary>> =>
      ipcRenderer.invoke('tickets:markLost', number),
    assign: (payload: {
      ticketNumber: number
      sellerId?: string
      seller?: {
        fullName: string
        documentId?: string
        phone?: string
        address?: string
      }
    }): Promise<ApiResult<TicketSummary>> => ipcRenderer.invoke(IPC_CHANNELS.TICKETS_ASSIGN, payload),
    setBuyer: (payload: {
      ticketNumber: number
      fullName: string
    }): Promise<ApiResult<TicketSummary>> => ipcRenderer.invoke(IPC_CHANNELS.TICKETS_SET_BUYER, payload)
  },
  sales: {
    create: (payload: CreateSaleInput): Promise<ApiResult<TicketSummary>> =>
      ipcRenderer.invoke('sales:create', payload)
  },
  payments: {
    create: (
      payload: CreatePaymentInput
    ): Promise<ApiResult<{ ticket: TicketSummary; payment: PaymentSummary }>> =>
      ipcRenderer.invoke('payments:create', payload),
    listByTicket: (ticketNumber: number): Promise<ApiResult<PaymentSummary[]>> =>
      ipcRenderer.invoke('payments:listByTicket', ticketNumber),
    update: (
      payload: UpdatePaymentInput
    ): Promise<ApiResult<{ ticket: TicketSummary; payment: PaymentSummary }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.PAYMENTS_UPDATE, payload),
    void: (id: string): Promise<ApiResult<{ ticket: TicketSummary; payment: PaymentSummary }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.PAYMENTS_VOID, id)
  },
  buyers: {
    list: (payload?: { query?: string; take?: number }): Promise<ApiResult<BuyerSummary[]>> =>
      ipcRenderer.invoke('buyers:list', payload),
    upsert: (payload: {
      fullName: string
      documentId: string
      phone: string
      address?: string | null
      email?: string | null
      notes?: string | null
    }): Promise<ApiResult<BuyerSummary>> => ipcRenderer.invoke('buyers:upsert', payload)
  },
  sellers: {
    list: (payload?: {
      query?: string
      onlyActive?: boolean
      take?: number
    }): Promise<ApiResult<SellerSummary[]>> => ipcRenderer.invoke('sellers:list', payload),
    upsert: (payload: {
      id?: string
      fullName: string
      documentId?: string
      phone?: string
      address?: string | null
      status?: 'ACTIVO' | 'INACTIVO'
      notes?: string | null
    }): Promise<ApiResult<SellerSummary>> => ipcRenderer.invoke('sellers:upsert', payload),
    getById: (id: string): Promise<ApiResult<SellerSummary>> =>
      ipcRenderer.invoke('sellers:getById', id),
    exportTicketsWord: (id: string): Promise<ApiResult<{ filePath: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SELLERS_EXPORT_TICKETS_WORD, id),
    exportPaymentsWord: (id: string): Promise<ApiResult<{ filePath: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SELLERS_EXPORT_PAYMENTS_WORD, id)
  },
  paymentMethods: {
    listActive: (): Promise<ApiResult<PaymentMethodSummary[]>> =>
      ipcRenderer.invoke('paymentMethods:listActive'),
    list: (): Promise<ApiResult<PaymentMethodSummary[]>> =>
      ipcRenderer.invoke('paymentMethods:list'),
    upsert: (payload: {
      id?: string
      name: string
      status?: 'ACTIVO' | 'INACTIVO'
    }): Promise<ApiResult<PaymentMethodSummary>> =>
      ipcRenderer.invoke('paymentMethods:upsert', payload)
  },
  users: {
    list: (): Promise<ApiResult<UserSummary[]>> => ipcRenderer.invoke('users:list'),
    create: (payload: {
      username: string
      fullName: string
      password: string
      role: 'ADMIN' | 'USER'
    }): Promise<ApiResult<UserSummary>> => ipcRenderer.invoke('users:create', payload),
    update: (payload: {
      id: string
      username?: string
      fullName?: string
      password?: string
      role?: 'ADMIN' | 'USER'
      isActive?: boolean
    }): Promise<ApiResult<UserSummary>> => ipcRenderer.invoke('users:update', payload)
  },
  settings: {
    getPublic: (): Promise<ApiResult<PublicSettings>> => ipcRenderer.invoke('settings:getPublic'),
    get: (): Promise<ApiResult<AppSettings>> => ipcRenderer.invoke('settings:get'),
    update: (payload: {
      companyName?: string
      raffleName?: string
      ticketCount?: number
      defaultTicketPrice?: number
      drawDate?: string
      ticketNumberPad?: number
      generateMissingTickets?: boolean
    }): Promise<ApiResult<AppSettings>> => ipcRenderer.invoke('settings:update', payload)
  },
  settlements: {
    create: (
      payload: CreateSettlementInput
    ): Promise<ApiResult<{ ticket: TicketSummary; settlement: SettlementSummary }>> =>
      ipcRenderer.invoke('settlements:create', payload),
    listPending: (payload?: {
      sellerId?: string
      query?: string
      take?: number
    }): Promise<ApiResult<{ items: TicketSummary[]; total: number; totalAmount: number }>> =>
      ipcRenderer.invoke('settlements:listPending', payload),
    list: (payload?: {
      sellerId?: string
      query?: string
      take?: number
    }): Promise<ApiResult<{ items: SettlementSummary[]; total: number; totalAmount: number }>> =>
      ipcRenderer.invoke('settlements:list', payload)
  },
  unsold: {
    listBySeller: (payload?: {
      sellerId?: string
      query?: string
      onlyWithSeller?: boolean
    }): Promise<
      ApiResult<{
        groups: UnsoldBySellerSummary[]
        totals: {
          unsoldCount: number
          ticketCount: number
          unsoldPercent: number
          withoutSellerCount: number
        }
      }>
    > => ipcRenderer.invoke('unsold:listBySeller', payload)
  },
  incomes: {
    list: (payload?: {
      from?: string
      to?: string
      type?: 'VENTA_INICIAL' | 'ABONO' | 'TODOS'
      query?: string
      take?: number
    }): Promise<ApiResult<IncomeListResult>> => ipcRenderer.invoke('incomes:list', payload)
  },
  expenses: {
    list: (payload?: {
      from?: string
      to?: string
      category?: string
      query?: string
      take?: number
    }): Promise<ApiResult<ExpenseListResult>> => ipcRenderer.invoke('expenses:list', payload),
    create: (payload: CreateExpenseInput): Promise<ApiResult<ExpenseSummary>> =>
      ipcRenderer.invoke('expenses:create', payload),
    void: (id: string): Promise<ApiResult<ExpenseSummary>> =>
      ipcRenderer.invoke('expenses:void', id),
    categories: (): Promise<ApiResult<string[]>> => ipcRenderer.invoke('expenses:categories')
  },
  reports: {
    listKinds: (): Promise<ApiResult<Array<{ kind: ReportKind; title: string }>>> =>
      ipcRenderer.invoke('reports:listKinds'),
    run: (payload: {
      kind: ReportKind
      from?: string
      to?: string
    }): Promise<ApiResult<ReportResult>> => ipcRenderer.invoke('reports:run', payload)
  },
  export: {
    excel: (payload?: {
      from?: string
      to?: string
    }): Promise<ApiResult<{ filePath: string; sheetCount: number }>> =>
      ipcRenderer.invoke('export:excel', payload)
  },
  backups: {
    list: (): Promise<ApiResult<BackupSummary[]>> => ipcRenderer.invoke('backups:list'),
    create: (payload?: {
      trigger?: BackupSummary['trigger']
      notes?: string
    }): Promise<ApiResult<BackupSummary>> => ipcRenderer.invoke('backups:create', payload),
    restore: (payload?: {
      backupId?: string
      filePath?: string
    }): Promise<ApiResult<{ restored: true; filePath: string; requiresRestart: boolean }>> =>
      ipcRenderer.invoke('backups:restore', payload),
    getSettings: (): Promise<ApiResult<BackupSettings>> =>
      ipcRenderer.invoke('backups:getSettings'),
    updateSettings: (payload: {
      backupFolder?: string
      autoBackupEnabled?: boolean
      autoBackupOnClose?: boolean
      backupScheduledEnabled?: boolean
      backupIntervalHours?: number
      allowSurplus?: boolean
    }): Promise<ApiResult<{ saved: true }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_UPDATE_SETTINGS, payload),
    chooseFolder: (): Promise<ApiResult<{ backupFolder: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_CHOOSE_FOLDER),
    latest: (): Promise<ApiResult<DashboardBackupCard | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_LATEST),
    uploadToDrive: (payload?: { backupId?: string }): Promise<ApiResult<BackupSummary>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_UPLOAD_DRIVE, payload),
    listDrive: (): Promise<
      ApiResult<{ files: { id: string; name: string; createdTime: string; sizeBytes: number }[] }>
    > => ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_LIST_DRIVE),
    deleteOld: (): Promise<ApiResult<{ deleted: number }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_DELETE_OLD)
  },
  voice: {
    parse: (raw: string): Promise<ApiResult<{ ok: boolean; action: string; message: string; navigateTo?: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.VOICE_PARSE, raw),
    listen: (): Promise<ApiResult<{ transcript: string }>> => ipcRenderer.invoke(IPC_CHANNELS.VOICE_LISTEN),
    cancelListen: (): Promise<ApiResult<{ cancelled: true }>> => ipcRenderer.invoke(IPC_CHANNELS.VOICE_CANCEL)
  },
  drive: {
    status: (): Promise<ApiResult<GoogleDriveStatus>> => ipcRenderer.invoke(IPC_CHANNELS.DRIVE_STATUS)
  },
  app: {
    getInfo: (): Promise<ApiResult<AppRuntimeInfo>> => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO)
  },
  audit: {
    list: (payload?: {
      from?: string
      to?: string
      module?: string
      query?: string
      take?: number
    }): Promise<ApiResult<AuditListResult>> => ipcRenderer.invoke('audit:list', payload),
    listModules: (): Promise<ApiResult<string[]>> => ipcRenderer.invoke('audit:listModules')
  },
  dashboard: {
    get: (payload?: {
      period?: 'hoy' | 'semana' | 'mes' | 'anio' | 'rango'
      from?: string
      to?: string
    }): Promise<ApiResult<DashboardSnapshot>> => ipcRenderer.invoke('dashboard:get', payload),
    home: (): Promise<ApiResult<HomeOverview>> => ipcRenderer.invoke('dashboard:home')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type RifaApi = typeof api
