import { ipcMain } from 'electron'
import * as authService from '../services/authService'
import * as ticketService from '../services/ticketService'
import * as dashboardService from '../services/dashboardService'
import * as saleService from '../services/saleService'
import * as paymentService from '../services/paymentService'
import * as buyerService from '../services/buyerService'
import * as sellerService from '../services/sellerService'
import * as paymentMethodService from '../services/paymentMethodService'

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

  ipcMain.handle('dashboard:get', async (_e, payload) =>
    dashboardService.getAdminDashboard(payload)
  )
}
