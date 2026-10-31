import { api } from './client'
import type { Paginated, Priority, Status, Ticket, TicketComment } from './types'

// query looks like "search=login&status=open&page=2"
export const listTickets = (query: string) => api<Paginated<Ticket>>(`/api/tickets/?${query}`)

export interface NewTicket {
  title: string
  description: string
  priority: Priority
}

export const createTicket = (body: NewTicket) =>
  api<{ id: number }>('/api/tickets/', { method: 'POST', body })

export const getTicket = (id: string | number) => api<Ticket>(`/api/tickets/${id}/`)

// Staff only. PATCH changes just the fields we send.
export const updateTicket = (id: string | number, patch: { status?: Status; priority?: Priority }) =>
  api<Ticket>(`/api/tickets/${id}/`, { method: 'PATCH', body: patch })

// Admin only
export const assignTicket = (id: string | number, agentId: number) =>
  api<Ticket>(`/api/tickets/${id}/assign/`, { method: 'POST', body: { agent_id: agentId } })

// Comments come back as a plain list (not paginated)
export const listComments = (id: string | number) =>
  api<TicketComment[]>(`/api/tickets/${id}/comments/`)

export const addComment = (id: string | number, body: string) =>
  api<TicketComment>(`/api/tickets/${id}/comments/`, { method: 'POST', body: { body } })