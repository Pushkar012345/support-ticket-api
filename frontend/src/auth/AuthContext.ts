import { createContext } from 'react'
import type { User } from '../api/types'

// What every page can read from useAuth()
export interface AuthContextValue {
  user: User | null // null = not logged in
  loading: boolean // true while we check an existing token on page load
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, email: string, password: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)