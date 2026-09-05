import { ipcMain } from 'electron'
import * as authService from '../services/authService'
import * as ticketService from '../services/ticketService'
import * as dashboardService from '../services/dashboardService'

export function registerIpcHandlers(): void {
  ipcMain.handle('auth:login', async (_e, payload) => authService.login(payload))
  ipcMain.handle('auth:logout', async () => authService.logout())
  ipcMain.handle('auth:me', async () => authService.me())

  ipcMain.handle('tickets:list', async (_e, payload) => ticketService.listTickets(payload))
  ipcMain.handle('tickets:getByNumber', async (_e, number: number) =>
    ticketService.getTicketByNumber(number)
  )
  ipcMain.handle('tickets:stats', async () => ticketService.getTicketStats())

  ipcMain.handle('dashboard:get', async (_e, payload) =>
    dashboardService.getAdminDashboard(payload)
  )
}
