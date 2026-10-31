import { api } from './client'
import type { User } from './types'

// Admin only (the backend returns 403 to everyone else)
export const listAgents = () => api<User[]>('/api/auth/agents/')