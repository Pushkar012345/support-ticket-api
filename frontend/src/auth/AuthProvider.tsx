import { useEffect, useState, type ReactNode } from 'react'
import { AUTH_LOGOUT_EVENT } from '../api/client'
import { fetchMe, login, logout, register } from '../api/auth'
import { clearTokens, getAccessToken } from '../api/tokens'
import type { User } from '../api/types'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Only "loading" if a token is stored: then we must check it before deciding anything.
  const [loading, setLoading] = useState(() => getAccessToken() !== null)

  // On page load: if a token exists, ask the backend who it belongs to.
  useEffect(() => {
    if (!getAccessToken()) return
    fetchMe()
      .then(setUser)
      .catch(() => clearTokens()) // token is bad or expired for good
      .finally(() => setLoading(false))
  }, [])

  // The API client fires this event when a token refresh fails (session really over).
  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout)
  }, [])

  const value = {
    user,
    loading,
    signIn: async (username: string, password: string) => {
      setUser(await login(username, password))
    },
    signUp: async (username: string, email: string, password: string) => {
      setUser(await register(username, email, password))
    },
    signOut: () => {
      logout()
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}