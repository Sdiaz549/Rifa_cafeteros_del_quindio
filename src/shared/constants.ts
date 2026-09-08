export const APP_NAME = 'RIFA'
export const COMPANY_NAME = 'Cafeteros del Quindío'
export const DEFAULT_TICKET_COUNT = 10_000
export const DEFAULT_TICKET_PRICE = 50_000
export const TICKET_NUMBER_PAD = 4

export const SETTING_KEYS = {
  companyName: 'companyName',
  raffleName: 'raffleName',
  ticketCount: 'ticketCount',
  defaultTicketPrice: 'defaultTicketPrice',
  drawDate: 'drawDate',
  backupFolder: 'backupFolder',
  autoBackupEnabled: 'autoBackupEnabled',
  autoBackupOnClose: 'autoBackupOnClose',
  ticketNumberPad: 'ticketNumberPad'
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]
