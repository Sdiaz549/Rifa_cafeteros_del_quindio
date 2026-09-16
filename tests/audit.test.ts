import { describe, expect, it } from 'vitest'
import { hasPermission } from '../src/shared/permissions'

describe('audit permissions', () => {
  it('restricts audit viewing to ADMIN', () => {
    expect(hasPermission('ADMIN', 'audit:view')).toBe(true)
    expect(hasPermission('USER', 'audit:view')).toBe(false)
  })
})
