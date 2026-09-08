import { z } from 'zod'
import { getPrisma } from '../db/client'
import { requireSession } from '../auth/session'
import { hashPassword } from '../auth/password'
import { assertPermission, type RoleCode } from '../../shared/permissions'
import { writeAuditLog } from '../audit/auditService'
import type { ApiResult, UserSummary } from '../../shared/types'

const createSchema = z.object({
  username: z.string().trim().min(3, 'El usuario debe tener al menos 3 caracteres.'),
  fullName: z.string().trim().min(3, 'El nombre es obligatorio.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  role: z.enum(['ADMIN', 'USER'])
})

const updateSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(3).optional(),
  password: z.string().min(8).optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional()
})

function mapUser(u: {
  id: string
  username: string
  fullName: string
  isActive: boolean
  createdAt: Date
  role: { code: string; name: string }
}): UserSummary {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role.code as RoleCode,
    roleName: u.role.name,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString()
  }
}

async function getRoleId(code: RoleCode): Promise<string> {
  const role = await getPrisma().role.findUnique({ where: { code } })
  if (!role) throw new Error(`Rol ${code} no encontrado.`)
  return role.id
}

export async function listUsers(): Promise<ApiResult<UserSummary[]>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'users:manage')
    const users = await getPrisma().user.findMany({
      include: { role: true },
      orderBy: { fullName: 'asc' }
    })
    return { ok: true, data: users.map(mapUser) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al listar usuarios' }
  }
}

export async function createUser(raw: unknown): Promise<ApiResult<UserSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'users:manage')
    const parsed = createSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const prisma = getPrisma()
    const exists = await prisma.user.findUnique({ where: { username: parsed.data.username } })
    if (exists) {
      return { ok: false, error: 'Ya existe un usuario con ese nombre.' }
    }
    const roleId = await getRoleId(parsed.data.role)
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        fullName: parsed.data.fullName,
        passwordHash: await hashPassword(parsed.data.password),
        roleId,
        isActive: true
      },
      include: { role: true }
    })
    await writeAuditLog({
      userId: session.userId,
      module: 'USUARIOS',
      action: 'USUARIO_CREADO',
      entity: 'User',
      entityId: user.id,
      newValue: { username: user.username, role: parsed.data.role }
    })
    return { ok: true, data: mapUser(user) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear usuario' }
  }
}

export async function updateUser(raw: unknown): Promise<ApiResult<UserSummary>> {
  try {
    const session = requireSession()
    assertPermission(session.role, 'users:manage')
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const prisma = getPrisma()
    const existing = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      include: { role: true }
    })
    if (!existing) return { ok: false, error: 'Usuario no encontrado.' }

    if (parsed.data.isActive === false) {
      if (existing.id === session.userId) {
        return { ok: false, error: 'No puede desactivar su propio usuario.' }
      }
      if (existing.role.code === 'ADMIN') {
        const activeAdmins = await prisma.user.count({
          where: { isActive: true, role: { code: 'ADMIN' } }
        })
        if (activeAdmins <= 1) {
          return { ok: false, error: 'Debe quedar al menos un administrador activo.' }
        }
      }
    }

    if (parsed.data.role === 'USER' && existing.role.code === 'ADMIN') {
      const activeAdmins = await prisma.user.count({
        where: { isActive: true, role: { code: 'ADMIN' } }
      })
      if (activeAdmins <= 1) {
        return { ok: false, error: 'Debe quedar al menos un administrador activo.' }
      }
    }

    const roleId = parsed.data.role ? await getRoleId(parsed.data.role) : existing.roleId
    const passwordHash =
      parsed.data.password && parsed.data.password.length >= 8
        ? await hashPassword(parsed.data.password)
        : undefined

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: parsed.data.fullName ?? existing.fullName,
        roleId,
        isActive: parsed.data.isActive ?? existing.isActive,
        ...(passwordHash ? { passwordHash } : {})
      },
      include: { role: true }
    })

    await writeAuditLog({
      userId: session.userId,
      module: 'USUARIOS',
      action: 'USUARIO_ACTUALIZADO',
      entity: 'User',
      entityId: user.id,
      previousValue: { fullName: existing.fullName, role: existing.role.code, isActive: existing.isActive },
      newValue: { fullName: user.fullName, role: user.role.code, isActive: user.isActive }
    })

    return { ok: true, data: mapUser(user) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al actualizar usuario' }
  }
}
