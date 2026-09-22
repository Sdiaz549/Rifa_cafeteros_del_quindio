import { ipcMain } from 'electron'
import * as authService from '../services/authService'
import * as ticketService from '../services/ticketService'
import * as dashboardService from '../services/dashboardService'
import * as saleService from '../services/saleService'
import * as paymentService from '../services/paymentService'
import * as buyerService from '../services/buyerService'
import * as sellerService from '../services/sellerService'
import { exportSellerTicketsWord, exportSellerPaymentsWord } from '../services/sellerWordExport'
import * as paymentMethodService from '../services/paymentMethodService'
import * as settlementService from '../services/settlementService'
import * as unsoldService from '../services/unsoldService'
import * as incomeService from '../services/incomeService'
import * as expenseService from '../services/expenseService'
import * as reportService from '../services/reportService'
import * as excelExportService from '../services/excelExportService'
import * as backupService from '../services/backupService'
import * as auditService from '../audit/auditService'
import * as userService from '../services/userService'
import * as settingsService from '../services/settingsService'
import { voiceCommandService } from '../services/voiceCommandService'
import { cancelWindowsListen, listenWindowsSpeech, warmupWindowsSpeech } from '../services/windowsSpeech'
import { getAppRuntimeInfo } from '../app/runtimeInfo'
import { requireSession } from '../auth/session'
import { IPC_CHANNELS, isAllowedIpcChannel, type IpcChannel } from '../../shared/ipc/channels'

type IpcHandler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown

const handlers: Record<IpcChannel, IpcHandler> = {
  [IPC_CHANNELS.AUTH_LOGIN]: async (_e, payload) => authService.login(payload),
  [IPC_CHANNELS.AUTH_LOGOUT]: async () => authService.logout(),
  [IPC_CHANNELS.AUTH_ME]: async () => authService.me(),

  [IPC_CHANNELS.TICKETS_LIST]: async (_e, payload) =>
    ticketService.listTickets(payload as Parameters<typeof ticketService.listTickets>[0]),
  [IPC_CHANNELS.TICKETS_BOARD]: async () => ticketService.getTicketBoard(),
  [IPC_CHANNELS.TICKETS_GET_BY_NUMBER]: async (_e, number) =>
    ticketService.getTicketByNumber(number as number),
  [IPC_CHANNELS.TICKETS_STATS]: async () => ticketService.getTicketStats(),
  [IPC_CHANNELS.TICKETS_MARK_LOST]: async (_e, number) =>
    ticketService.markTicketLost(number as number),
  [IPC_CHANNELS.TICKETS_ASSIGN]: async (_e, payload) =>
    ticketService.assignTicketToSeller(
      payload as Parameters<typeof ticketService.assignTicketToSeller>[0]
    ),
  [IPC_CHANNELS.TICKETS_SET_BUYER]: async (_e, payload) =>
    ticketService.setTicketBuyer(payload as Parameters<typeof ticketService.setTicketBuyer>[0]),

  [IPC_CHANNELS.SALES_CREATE]: async (_e, payload) =>
    saleService.createSale(payload as Parameters<typeof saleService.createSale>[0]),

  [IPC_CHANNELS.PAYMENTS_CREATE]: async (_e, payload) =>
    paymentService.createPayment(payload as Parameters<typeof paymentService.createPayment>[0]),
  [IPC_CHANNELS.PAYMENTS_LIST_BY_TICKET]: async (_e, ticketNumber) =>
    paymentService.listPaymentsByTicket(ticketNumber as number),

  [IPC_CHANNELS.BUYERS_LIST]: async (_e, payload) =>
    buyerService.listBuyers(payload as Parameters<typeof buyerService.listBuyers>[0]),
  [IPC_CHANNELS.BUYERS_UPSERT]: async (_e, payload) =>
    buyerService.upsertBuyer(payload as Parameters<typeof buyerService.upsertBuyer>[0]),

  [IPC_CHANNELS.SELLERS_LIST]: async (_e, payload) =>
    sellerService.listSellers(payload as Parameters<typeof sellerService.listSellers>[0]),
  [IPC_CHANNELS.SELLERS_UPSERT]: async (_e, payload) =>
    sellerService.upsertSeller(payload as Parameters<typeof sellerService.upsertSeller>[0]),
  [IPC_CHANNELS.SELLERS_GET_BY_ID]: async (_e, id) => sellerService.getSellerById(id as string),
  [IPC_CHANNELS.SELLERS_EXPORT_TICKETS_WORD]: async (_e, id) =>
    exportSellerTicketsWord(id as string),
  [IPC_CHANNELS.SELLERS_EXPORT_PAYMENTS_WORD]: async (_e, id) =>
    exportSellerPaymentsWord(id as string),

  [IPC_CHANNELS.PAYMENT_METHODS_LIST_ACTIVE]: async () =>
    paymentMethodService.listActivePaymentMethods(),
  [IPC_CHANNELS.PAYMENT_METHODS_LIST]: async () => paymentMethodService.listPaymentMethods(),
  [IPC_CHANNELS.PAYMENT_METHODS_UPSERT]: async (_e, payload) =>
    paymentMethodService.upsertPaymentMethod(
      payload as Parameters<typeof paymentMethodService.upsertPaymentMethod>[0]
    ),

  [IPC_CHANNELS.USERS_LIST]: async () => userService.listUsers(),
  [IPC_CHANNELS.USERS_CREATE]: async (_e, payload) =>
    userService.createUser(payload as Parameters<typeof userService.createUser>[0]),
  [IPC_CHANNELS.USERS_UPDATE]: async (_e, payload) =>
    userService.updateUser(payload as Parameters<typeof userService.updateUser>[0]),

  [IPC_CHANNELS.SETTINGS_GET_PUBLIC]: async () => settingsService.getPublicSettings(),
  [IPC_CHANNELS.SETTINGS_GET]: async () => settingsService.getAppSettings(),
  [IPC_CHANNELS.SETTINGS_UPDATE]: async (_e, payload) => settingsService.updateAppSettings(payload),

  [IPC_CHANNELS.SETTLEMENTS_CREATE]: async (_e, payload) =>
    settlementService.settleTicket(
      payload as Parameters<typeof settlementService.settleTicket>[0]
    ),
  [IPC_CHANNELS.SETTLEMENTS_LIST_PENDING]: async (_e, payload) =>
    settlementService.listPendingSettlements(
      payload as Parameters<typeof settlementService.listPendingSettlements>[0]
    ),
  [IPC_CHANNELS.SETTLEMENTS_LIST]: async (_e, payload) =>
    settlementService.listSettlements(payload as Parameters<typeof settlementService.listSettlements>[0]),

  [IPC_CHANNELS.UNSOLD_LIST_BY_SELLER]: async (_e, payload) =>
    unsoldService.listUnsoldBySeller(payload as Parameters<typeof unsoldService.listUnsoldBySeller>[0]),

  [IPC_CHANNELS.INCOMES_LIST]: async (_e, payload) =>
    incomeService.listIncomes(payload as Parameters<typeof incomeService.listIncomes>[0]),

  [IPC_CHANNELS.EXPENSES_LIST]: async (_e, payload) =>
    expenseService.listExpenses(payload as Parameters<typeof expenseService.listExpenses>[0]),
  [IPC_CHANNELS.EXPENSES_CREATE]: async (_e, payload) =>
    expenseService.createExpense(payload as Parameters<typeof expenseService.createExpense>[0]),
  [IPC_CHANNELS.EXPENSES_VOID]: async (_e, id) => expenseService.voidExpense(id as string),
  [IPC_CHANNELS.EXPENSES_CATEGORIES]: async () => {
    try {
      requireSession()
      return { ok: true as const, data: [...expenseService.EXPENSE_CATEGORIES] }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error' }
    }
  },

  [IPC_CHANNELS.REPORTS_LIST_KINDS]: async () => {
    try {
      const session = requireSession()
      return { ok: true as const, data: reportService.listReportKinds(session.role) }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error' }
    }
  },
  [IPC_CHANNELS.REPORTS_RUN]: async (_e, payload) =>
    reportService.runReport(payload as Parameters<typeof reportService.runReport>[0]),

  [IPC_CHANNELS.EXPORT_EXCEL]: async (_e, payload) =>
    excelExportService.exportFullWorkbook(
      payload as Parameters<typeof excelExportService.exportFullWorkbook>[0]
    ),

  [IPC_CHANNELS.BACKUPS_LIST]: async () => backupService.listLocalBackups(),
  [IPC_CHANNELS.BACKUPS_CREATE]: async (_e, payload) =>
    backupService.createBackup(payload as Parameters<typeof backupService.createBackup>[0]),
  [IPC_CHANNELS.BACKUPS_RESTORE]: async (_e, payload) =>
    backupService.restoreBackup(payload as Parameters<typeof backupService.restoreBackup>[0]),
  [IPC_CHANNELS.BACKUPS_GET_SETTINGS]: async () => backupService.getBackupSettings(),
  [IPC_CHANNELS.BACKUPS_UPDATE_SETTINGS]: async (_e, payload) =>
    backupService.updateBackupSettings(
      payload as Parameters<typeof backupService.updateBackupSettings>[0]
    ),
  [IPC_CHANNELS.BACKUPS_CHOOSE_FOLDER]: async () => backupService.chooseBackupFolder(),
  [IPC_CHANNELS.BACKUPS_LATEST]: async () => backupService.latestBackup(),
  [IPC_CHANNELS.BACKUPS_UPLOAD_DRIVE]: async (_e, payload) =>
    backupService.uploadBackupToDrive(
      payload as Parameters<typeof backupService.uploadBackupToDrive>[0]
    ),
  [IPC_CHANNELS.BACKUPS_LIST_DRIVE]: async () => backupService.listDriveBackups(),
  [IPC_CHANNELS.BACKUPS_DELETE_OLD]: async () => backupService.deleteOldBackups(),

  [IPC_CHANNELS.AUDIT_LIST]: async (_e, payload) =>
    auditService.listAuditLogs(payload as Parameters<typeof auditService.listAuditLogs>[0]),
  [IPC_CHANNELS.AUDIT_LIST_MODULES]: async () => auditService.listAuditModules(),

  [IPC_CHANNELS.DASHBOARD_GET]: async (_e, payload) =>
    dashboardService.getAdminDashboard(
      payload as Parameters<typeof dashboardService.getAdminDashboard>[0]
    ),
  [IPC_CHANNELS.DASHBOARD_HOME]: async () => dashboardService.getHomeOverview(),

  [IPC_CHANNELS.VOICE_PARSE]: async (_e, raw) => {
    try {
      const session = requireSession()
      return {
        ok: true as const,
        data: await voiceCommandService.execute(String(raw ?? ''), { session })
      }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error de voz' }
    }
  },

  [IPC_CHANNELS.VOICE_LISTEN]: async () => {
    try {
      requireSession()
      return await listenWindowsSpeech()
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error de voz' }
    }
  },

  [IPC_CHANNELS.VOICE_CANCEL]: async () => {
    try {
      requireSession()
      cancelWindowsListen()
      return { ok: true as const, data: { cancelled: true as const } }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error de voz' }
    }
  },

  [IPC_CHANNELS.DRIVE_STATUS]: async () => {
    try {
      requireSession()
      return { ok: true as const, data: backupService.getDriveStatus() }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error' }
    }
  },

  [IPC_CHANNELS.APP_GET_INFO]: async () => {
    return { ok: true as const, data: getAppRuntimeInfo() }
  }
}

export function registerIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) {
    if (!(channel in handlers)) {
      throw new Error(`Falta handler IPC para el canal autorizado: ${channel}`)
    }
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    if (!isAllowedIpcChannel(channel)) {
      throw new Error(`Canal IPC no autorizado: ${channel}`)
    }
    ipcMain.handle(channel, handler)
  }
}
