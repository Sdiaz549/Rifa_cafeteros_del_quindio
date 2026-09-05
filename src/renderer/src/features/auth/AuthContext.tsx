import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { SessionUser } from '@shared/types'
import { hasPermission, type Permission } from '@shared/permissions'

interface AuthContextValue {
  session: SessionUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.api.auth.me()
        if (res.ok) setSession(res.data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await window.api.auth.login({ username, password })
    if (!res.ok) return res.error
    setSession(res.data)
    return null
  }, [])

  const logout = useCallback(async () => {
    await window.api.auth.logout()
    setSession(null)
  }, [])

  const can = useCallback(
    (permission: Permission) => (session ? hasPermission(session.role, permission) : false),
    [session]
  )

  const value = useMemo(
    () => ({ session, loading, login, logout, can }),
    [session, loading, login, logout, can]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
