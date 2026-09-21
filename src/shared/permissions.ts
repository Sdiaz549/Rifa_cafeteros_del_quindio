export type RoleCode = 'ADMIN' | 'USER'

export type Permission =
  | 'dashboard:view'
  | 'incomes:view'
  | 'expenses:manage'
  | 'users:manage'
  | 'payment_methods:manage'
  | 'settings:manage'
  | 'backups:manage'
  | 'audit:view'
  | 'reports:financial'
  | 'reports:operational'
  | 'export:full'
  | 'tickets:view'
  | 'tickets:sell'
  | 'tickets:mark_lost'
  | 'payments:create'
  | 'buyers:manage'
  | 'sellers:manage'
  | 'settlements:manage'
  | 'unsold:view'

const ADMIN_ONLY: Permission[] = [
  'dashboard:view',
  'incomes:view',
  'expenses:manage',
  'users:manage',
  'payment_methods:manage',
  'settings:manage',
  'backups:manage',
  'audit:view',
  'reports:financial',
  'export:full',
  'tickets:mark_lost',
  'settlements:manage'
]

const USER_PERMS: Permission[] = [
  'tickets:view',
  'tickets:sell',
  'payments:create',
  'buyers:manage',
  'sellers:manage',
  'reports:operational',
  'unsold:view'
]

const ROLE_PERMISSIONS: Record<RoleCode, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([...ADMIN_ONLY, ...USER_PERMS]),
  USER: new Set<Permission>(USER_PERMS)
}

export function hasPermission(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

export function assertPermission(role: RoleCode, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error('No tiene permisos para realizar esta acción.')
  }
}
