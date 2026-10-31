import { api } from './client'
import { clearTokens, setTokens } from './tokens'
import type { User } from './types'

export async function login(username: string, password: string): Promise<User> {
  const tokens = await api<{ access: string; refresh: string }>('/api/auth/token/', {
    method: 'POST',
    body: { username, password },
    auth: false,
  })
  setTokens(tokens.access, tokens.refresh)
  return api<User>('/api/auth/me/')
}

export async function register(username: string, email: string, password: string): Promise<User> {
  await api('/api/auth/register/', {
    method: 'POST',
    body: { username, email, password },
    auth: false,
  })
  return login(username, password) // log them in right after signing up
}

export const fetchMe = () => api<User>('/api/auth/me/')

export function logout() {
  clearTokens()
}