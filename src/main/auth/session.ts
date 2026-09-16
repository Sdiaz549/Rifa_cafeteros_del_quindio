import type { RoleCode } from '../../shared/permissions'
import type { SessionUser } from '../../shared/types'

let currentSession: SessionUser | null = null

export function getSession(): SessionUser | null {
  return currentSession
}

export function requireSession(): SessionUser {
  if (!currentSession) {
    throw new Error('Debe iniciar sesión.')
  }
  return currentSession
}

export function setSession(session: SessionUser): void {
  currentSession = session
}

export function clearSession(): void {
  currentSession = null
}

export function createSession(input: {
  userId: string
  username: string
  fullName: string
  role: RoleCode
}): SessionUser {
  const session: SessionUser = {
    ...input,
    startedAt: new Date().toISOString()
  }
  setSession(session)
  return session
}
