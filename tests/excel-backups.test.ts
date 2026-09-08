import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/shared/permissions'
import {
  EXPORT_SHEET_NAMES,
  buildExportFileName
} from '../src/main/services/excelExportService'
import { buildBackupFileName } from '../src/main/services/backupService'

describe('export/backup permissions', () => {
  it('restricts full Excel export and backups to ADMIN', () => {
    expect(hasPermission('ADMIN', 'export:full')).toBe(true)
    expect(hasPermission('USER', 'export:full')).toBe(false)
    expect(hasPermission('ADMIN', 'backups:manage')).toBe(true)
    expect(hasPermission('USER', 'backups:manage')).toBe(false)
  })
})

describe('excel export helpers', () => {
  it('builds a dated xlsx filename', () => {
    const name = buildExportFileName(new Date('2026-09-05T15:30:00'))
    expect(name).toBe('export_rifa_2026-09-05_1530.xlsx')
  })

  it('defines the required multi-sheet catalog without user secrets', () => {
    expect([...EXPORT_SHEET_NAMES]).toEqual([
      'Boletas',
      'Compradores',
      'Vendedores',
      'Ventas',
      'Pagos',
      'Liquidaciones',
      'Egresos'
    ])
    expect(EXPORT_SHEET_NAMES).not.toContain('Usuarios')
    expect(EXPORT_SHEET_NAMES).not.toContain('Passwords')
  })
})

describe('backup helpers', () => {
  it('builds a dated sqlite backup filename', () => {
    const name = buildBackupFileName(new Date('2026-09-05T15:30:00'))
    expect(name).toBe('backup_rifa_2026-09-05_1530.db')
  })
})
