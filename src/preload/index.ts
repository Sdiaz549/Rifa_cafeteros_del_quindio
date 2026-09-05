import { contextBridge, ipcRenderer } from 'electron'
import type { ApiResult, SessionUser, TicketSummary } from '../shared/types'

const api = {
  auth: {
    login: (payload: { username: string; password: string }): Promise<ApiResult<SessionUser>> =>
      ipcRenderer.invoke('auth:login', payload),
    logout: (): Promise<ApiResult<{ loggedOut: true }>> => ipcRenderer.invoke('auth:logout'),
    me: (): Promise<ApiResult<SessionUser>> => ipcRenderer.invoke('auth:me')
  },
  tickets: {
    list: (payload?: {
      query?: string
      status?: string
      take?: number
      skip?: number
    }): Promise<ApiResult<{ items: TicketSummary[]; total: number }>> =>
      ipcRenderer.invoke('tickets:list', payload),
    getByNumber: (number: number) => ipcRenderer.invoke('tickets:getByNumber', number),
    stats: () => ipcRenderer.invoke('tickets:stats')
  },
  dashboard: {
    get: (payload?: { from?: string; to?: string }) =>
      ipcRenderer.invoke('dashboard:get', payload)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type RifaApi = typeof api
