/**
 * Lista blanca de canales IPC.
 * El renderer solo puede invocar estos nombres a través del preload.
 * Añadir un canal aquí es obligatorio para registrarlo en main y exponerlo en preload.
 */
export const IPC_CHANNELS = {
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_ME: 'auth:me',

  TICKETS_LIST: 'tickets:list',
  TICKETS_BOARD: 'tickets:board',
  TICKETS_GET_BY_NUMBER: 'tickets:getByNumber',
  TICKETS_STATS: 'tickets:stats',
  TICKETS_MARK_LOST: 'tickets:markLost',
  TICKETS_ASSIGN: 'tickets:assign',

  SALES_CREATE: 'sales:create',

  PAYMENTS_CREATE: 'payments:create',
  PAYMENTS_LIST_BY_TICKET: 'payments:listByTicket',

  BUYERS_LIST: 'buyers:list',
  BUYERS_UPSERT: 'buyers:upsert',

  SELLERS_LIST: 'sellers:list',
  SELLERS_UPSERT: 'sellers:upsert',
  SELLERS_GET_BY_ID: 'sellers:getById',

  PAYMENT_METHODS_LIST_ACTIVE: 'paymentMethods:listActive',
  PAYMENT_METHODS_LIST: 'paymentMethods:list',
  PAYMENT_METHODS_UPSERT: 'paymentMethods:upsert',

  USERS_LIST: 'users:list',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',

  SETTINGS_GET_PUBLIC: 'settings:getPublic',
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  SETTLEMENTS_CREATE: 'settlements:create',
  SETTLEMENTS_LIST_PENDING: 'settlements:listPending',
  SETTLEMENTS_LIST: 'settlements:list',

  UNSOLD_LIST_BY_SELLER: 'unsold:listBySeller',

  INCOMES_LIST: 'incomes:list',

  EXPENSES_LIST: 'expenses:list',
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_VOID: 'expenses:void',
  EXPENSES_CATEGORIES: 'expenses:categories',

  REPORTS_LIST_KINDS: 'reports:listKinds',
  REPORTS_RUN: 'reports:run',

  EXPORT_EXCEL: 'export:excel',

  BACKUPS_LIST: 'backups:list',
  BACKUPS_CREATE: 'backups:create',
  BACKUPS_RESTORE: 'backups:restore',
  BACKUPS_GET_SETTINGS: 'backups:getSettings',
  BACKUPS_UPDATE_SETTINGS: 'backups:updateSettings',
  BACKUPS_CHOOSE_FOLDER: 'backups:chooseFolder',
  BACKUPS_LATEST: 'backups:latest',
  BACKUPS_UPLOAD_DRIVE: 'backups:uploadDrive',
  BACKUPS_LIST_DRIVE: 'backups:listDrive',
  BACKUPS_DELETE_OLD: 'backups:deleteOld',

  AUDIT_LIST: 'audit:list',
  AUDIT_LIST_MODULES: 'audit:listModules',

  DASHBOARD_GET: 'dashboard:get',
  DASHBOARD_HOME: 'dashboard:home',

  VOICE_PARSE: 'voice:parse',

  DRIVE_STATUS: 'drive:status',

  APP_GET_INFO: 'app:getInfo'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export const IPC_CHANNEL_SET: ReadonlySet<string> = new Set(Object.values(IPC_CHANNELS))

export function isAllowedIpcChannel(channel: string): channel is IpcChannel {
  return IPC_CHANNEL_SET.has(channel)
}
