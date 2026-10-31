// Shapes of the JSON the backend sends. They mirror our DRF serializers.

export type Role = 'admin' | 'agent' | 'customer'

export interface User {
  id: number
  username: string
  email: string
  role: Role
}

export type Status = 'open' | 'in_progress' | 'resolved' | 'closed'
export type Priority = 'low' | 'medium' | 'high'

export interface Ticket {
  id: number
  title: string
  description: string
  status: Status
  priority: Priority
  created_by: string // text label like "alice (customer)"
  assigned_to: string | null
  ai_suggested_reply?: string // missing for customers (the backend hides it)
  created_at: string
  updated_at: string
}

export interface TicketComment {
  id: number
  author: string
  body: string
  created_at: string
}

// Every list endpoint is paginated, so lists arrive wrapped like this
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}