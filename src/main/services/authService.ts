import { z } from 'zod'
import { getPrisma } from '../db/client'
import { verifyPassword } from '../auth/password'
import { clearSession, createSession, getSession, requireSession } from '../auth/session'
import { writeAuditLog } from '../audit/auditService'
import type { RoleCode } from '../../shared/permissions'
import type { ApiResult, SessionUser } from '../../shared/types'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

export async function login(raw: unknown): Promise<ApiResult<SessionUser>> {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Usuario y contraseña son obligatorios.' }
  }

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    include: { role: true }
  })

  if (!user || !user.isActive) {
    return { ok: false, error: 'Credenciales inválidas.' }
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!valid) {
    return { ok: false, error: 'Credenciales inválidas.' }
  }

  const session = createSession({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role.code as RoleCode
  })

  await writeAuditLog({
    userId: user.id,
    module: 'AUTH',
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    origin: 'MANUAL'
  })

  return { ok: true, data: session }
}

export function logout(): ApiResult<{ loggedOut: true }> {
  const session = getSession()
  clearSession()
  if (session) {
    void writeAuditLog({
      userId: session.userId,
      module: 'AUTH',
      action: 'LOGOUT',
      entity: 'User',
      entityId: session.userId
    })
  }
  return { ok: true, data: { loggedOut: true } }
}

export function me(): ApiResult<SessionUser> {
  try {
    return { ok: true, data: requireSession() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Sin sesión' }
  }
}
