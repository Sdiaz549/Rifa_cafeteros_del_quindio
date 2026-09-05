import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  BuyerSummary,
  CreatePaymentInput,
  CreateSaleInput,
  PaymentMethodSummary,
  PaymentSummary,
  SellerSummary,
  SessionUser,
  TicketSummary
} from '../shared/types'

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
    stats: () => ipcRenderer.invoke('tickets:stats'),
    markLost: (number: number): Promise<ApiResult<TicketSummary>> =>
      ipcRenderer.invoke('tickets:markLost', number)
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
      ipcRenderer.invoke('payments:listByTicket', ticketNumber)
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
      fullName: string
      documentId: string
      phone: string
      address?: string | null
      status?: 'ACTIVO' | 'INACTIVO'
      notes?: string | null
    }): Promise<ApiResult<SellerSummary>> => ipcRenderer.invoke('sellers:upsert', payload),
    getById: (id: string): Promise<ApiResult<SellerSummary>> =>
      ipcRenderer.invoke('sellers:getById', id)
  },
  paymentMethods: {
    listActive: (): Promise<ApiResult<PaymentMethodSummary[]>> =>
      ipcRenderer.invoke('paymentMethods:listActive')
  },
  dashboard: {
    get: (payload?: { from?: string; to?: string }) =>
      ipcRenderer.invoke('dashboard:get', payload)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type RifaApi = typeof api
