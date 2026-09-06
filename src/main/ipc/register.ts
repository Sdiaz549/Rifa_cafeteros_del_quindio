import { ipcMain } from 'electron'
import * as authService from '../services/authService'
import * as ticketService from '../services/ticketService'
import * as dashboardService from '../services/dashboardService'
import * as saleService from '../services/saleService'
import * as paymentService from '../services/paymentService'
import * as buyerService from '../services/buyerService'
import * as sellerService from '../services/sellerService'
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
import { requireSession } from '../auth/session'

export function registerIpcHandlers(): void {
  ipcMain.handle('auth:login', async (_e, payload) => authService.login(payload))
  ipcMain.handle('auth:logout', async () => authService.logout())
  ipcMain.handle('auth:me', async () => authService.me())

  ipcMain.handle('tickets:list', async (_e, payload) => ticketService.listTickets(payload))
  ipcMain.handle('tickets:getByNumber', async (_e, number: number) =>
    ticketService.getTicketByNumber(number)
  )
  ipcMain.handle('tickets:stats', async () => ticketService.getTicketStats())
  ipcMain.handle('tickets:markLost', async (_e, number: number) =>
    ticketService.markTicketLost(number)
  )

  ipcMain.handle('sales:create', async (_e, payload) => saleService.createSale(payload))

  ipcMain.handle('payments:create', async (_e, payload) => paymentService.createPayment(payload))
  ipcMain.handle('payments:listByTicket', async (_e, ticketNumber: number) =>
    paymentService.listPaymentsByTicket(ticketNumber)
  )

  ipcMain.handle('buyers:list', async (_e, payload) => buyerService.listBuyers(payload))
  ipcMain.handle('buyers:upsert', async (_e, payload) => buyerService.upsertBuyer(payload))

  ipcMain.handle('sellers:list', async (_e, payload) => sellerService.listSellers(payload))
  ipcMain.handle('sellers:upsert', async (_e, payload) => sellerService.upsertSeller(payload))
  ipcMain.handle('sellers:getById', async (_e, id: string) => sellerService.getSellerById(id))

  ipcMain.handle('paymentMethods:listActive', async () =>
    paymentMethodService.listActivePaymentMethods()
  )
  ipcMain.handle('paymentMethods:list', async () => paymentMethodService.listPaymentMethods())
  ipcMain.handle('paymentMethods:upsert', async (_e, payload) =>
    paymentMethodService.upsertPaymentMethod(payload)
  )

  ipcMain.handle('users:list', async () => userService.listUsers())
  ipcMain.handle('users:create', async (_e, payload) => userService.createUser(payload))
  ipcMain.handle('users:update', async (_e, payload) => userService.updateUser(payload))

  ipcMain.handle('settings:getPublic', async () => settingsService.getPublicSettings())
  ipcMain.handle('settings:get', async () => settingsService.getAppSettings())
  ipcMain.handle('settings:update', async (_e, payload) =>
    settingsService.updateAppSettings(payload)
  )

  ipcMain.handle('settlements:create', async (_e, payload) => settlementService.settleTicket(payload))
  ipcMain.handle('settlements:listPending', async (_e, payload) =>
    settlementService.listPendingSettlements(payload)
  )
  ipcMain.handle('settlements:list', async (_e, payload) => settlementService.listSettlements(payload))

  ipcMain.handle('unsold:listBySeller', async (_e, payload) => unsoldService.listUnsoldBySeller(payload))

  ipcMain.handle('incomes:list', async (_e, payload) => incomeService.listIncomes(payload))

  ipcMain.handle('expenses:list', async (_e, payload) => expenseService.listExpenses(payload))
  ipcMain.handle('expenses:create', async (_e, payload) => expenseService.createExpense(payload))
  ipcMain.handle('expenses:void', async (_e, id: string) => expenseService.voidExpense(id))
  ipcMain.handle('expenses:categories', async () => {
    try {
      requireSession()
      return { ok: true as const, data: [...expenseService.EXPENSE_CATEGORIES] }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error' }
    }
  })

  ipcMain.handle('reports:listKinds', async () => {
    try {
      const session = requireSession()
      return { ok: true as const, data: reportService.listReportKinds(session.role) }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Error' }
    }
  })
  ipcMain.handle('reports:run', async (_e, payload) => reportService.runReport(payload))

  ipcMain.handle('export:excel', async (_e, payload) =>
    excelExportService.exportFullWorkbook(payload)
  )

  ipcMain.handle('backups:list', async () => backupService.listBackups())
  ipcMain.handle('backups:create', async (_e, payload) => backupService.createBackup(payload))
  ipcMain.handle('backups:restore', async (_e, payload) => backupService.restoreBackup(payload))
  ipcMain.handle('backups:getSettings', async () => backupService.getBackupSettings())
  ipcMain.handle('backups:updateSettings', async (_e, payload) =>
    backupService.updateBackupSettings(payload)
  )
  ipcMain.handle('backups:chooseFolder', async () => backupService.chooseBackupFolder())

  ipcMain.handle('audit:list', async (_e, payload) => auditService.listAuditLogs(payload))
  ipcMain.handle('audit:listModules', async () => auditService.listAuditModules())

  ipcMain.handle('dashboard:get', async (_e, payload) =>
    dashboardService.getAdminDashboard(payload)
  )
}
