import { describe, expect, it } from 'vitest'
import { splitSqlStatements } from '../src/main/db/sqlMigrator'
import { buildBackupFileName } from '../src/main/backup/localSnapshot'
import { DATABASE_FILE_NAME } from '../src/main/paths'

describe('sql migrator', () => {
  it('splits statements and ignores comments', () => {
    const sql = `
-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
`
    const parts = splitSqlStatements(sql)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain('CREATE TABLE')
    expect(parts[1]).toContain('CREATE UNIQUE INDEX')
  })
})

describe('packaging paths', () => {
  it('uses database.db as the live sqlite file name', () => {
    expect(DATABASE_FILE_NAME).toBe('database.db')
  })

  it('names backups without overwriting', () => {
    expect(buildBackupFileName(new Date('2026-09-08T15:30:00'))).toBe(
      'backup_2026-09-08_15-30-00.db'
    )
  })
})
