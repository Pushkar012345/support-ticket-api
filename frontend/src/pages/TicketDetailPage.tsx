import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, errorMessage } from '../api/client'
import { STATUS_LABELS } from '../api/labels'
import { addComment, assignTicket, getTicket, listComments, updateTicket } from '../api/tickets'
import type { Status, Ticket, TicketComment, User } from '../api/types'
import { listAgents } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { PriorityBadge, StatusBadge } from '../components/Badges'

// key={id} makes React start with fresh state whenever the ticket id in the URL changes
export default function TicketDetailPage() {
  const { id = '' } = useParams()
  return <TicketDetail key={id} id={id} />
}

function TicketDetail({ id }: { id: string }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isStaff = isAdmin || user?.role === 'agent'

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [agents, setAgents] = useState<User[]>([])
  const [agentId, setAgentId] = useState('')
  const [commentText, setCommentText] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  // Load the ticket and its comments together
  useEffect(() => {
    let cancelled = false
    Promise.all([getTicket(id), listComments(id)])
      .then(([t, c]) => {
        if (cancelled) return
        setTicket(t)
        setComments(c)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        // The backend answers 404 both for "doesn't exist" and "not yours", on purpose
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? 'Ticket not found, or you do not have access to it.'
            : errorMessage(err),
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Only admins can call the agents endpoint, so only they fetch the list
  useEffect(() => {
    if (!isAdmin) return
    listAgents()
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [isAdmin])

  // Runs any action with the shared busy flag and error box
  async function run(action: () => Promise<void>) {
    setActionError('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // The backend returns the updated ticket, so we just store it
  const changeStatus = (status: Status) =>
    run(async () => {
      setTicket(await updateTicket(id, { status }))
    })

  const assign = () =>
    run(async () => {
      setTicket(await assignTicket(id, Number(agentId)))
      setAgentId('')
    })

  // The AI draft is written a few seconds after creation, so staff may need to look again
  const checkAgain = () =>
    run(async () => {
      setTicket(await getTicket(id))
    })

  function postComment(e: FormEvent) {
    e.preventDefault()
    const body = commentText.trim()
    if (!body || busy) return
    return run(async () => {
      const created = await addComment(id, body)
      setComments((prev) => [...prev, created])
      setCommentText('')
    })
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Loading ticket...</p>

  if (loadError || !ticket) {
    return (
      <div className="space-y-3">
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{loadError || 'Ticket not found.'}</p>
        <Link to="/" className="text-sm text-indigo-600 hover:underline">
          ← Back to tickets
        </Link>
      </div>
    )
  }

  const inputClass = 'rounded border border-slate-300 bg-white p-2 text-sm'

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to tickets
      </Link>

      {/* Header */}
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Ticket #{ticket.id}</p>
            <h2 className="text-xl font-semibold text-slate-800">{ticket.title}</h2>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Created by</dt>
            <dd className="text-slate-800">{ticket.created_by}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Assigned to</dt>
            <dd className="text-slate-800">{ticket.assigned_to ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-800">{new Date(ticket.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last updated</dt>
            <dd className="text-slate-800">{new Date(ticket.updated_at).toLocaleString()}</dd>
          </div>
        </dl>

        {/* whitespace-pre-wrap keeps the customer's line breaks. React escapes the text, so it is safe. */}
        <p className="mt-4 whitespace-pre-wrap border-t pt-4 text-slate-700">{ticket.description}</p>
      </div>

      {actionError && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

      {/* Staff controls */}
      {isStaff && (
        <div className="flex flex-wrap items-end gap-6 rounded-xl bg-white p-4 shadow">
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              className={`${inputClass} mt-1 block`}
              value={ticket.status}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value as Status)}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {isAdmin && (
            <div className="text-sm font-medium text-slate-700">
              Assign to agent
              {agents.length === 0 ? (
                <p className="mt-1 font-normal text-slate-500">
                  No agents yet. Set a user's role to "agent" in the Django admin.
                </p>
              ) : (
                <div className="mt-1 flex gap-2">
                  <select
                    className={inputClass}
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">Select an agent...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={assign}
                    disabled={!agentId || busy}
                    className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI draft: staff only. The backend does not even send this field to customers. */}
      {isStaff && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="font-semibold text-indigo-900">AI suggested reply</h3>
          <p className="text-xs text-indigo-700">
            Written by an AI model. Review and edit it before sending. Customers cannot see this panel.
          </p>
          {ticket.ai_suggested_reply ? (
            <>
              <div className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm text-slate-800">
                {ticket.ai_suggested_reply}
              </div>
              <button
                onClick={() => setCommentText(ticket.ai_suggested_reply ?? '')}
                className="mt-3 rounded border border-indigo-300 bg-white px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100"
              >
                Use as comment
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No draft yet. It appears a few seconds after the ticket is created.{' '}
              <button onClick={checkAgain} disabled={busy} className="text-indigo-700 underline">
                Check again
              </button>
            </p>
          )}
        </section>
      )}

      {/* Comments */}
      <section className="space-y-3 rounded-xl bg-white p-6 shadow">
        <h3 className="font-semibold text-slate-800">Comments ({comments.length})</h3>

        {comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}

        {comments.map((c) => (
          <div key={c.id} className="rounded border border-slate-200 p-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">{c.author}</span>
              <span>{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{c.body}</p>
          </div>
        ))}

        <form onSubmit={postComment} className="space-y-2 border-t pt-4">
          <textarea
            className={`${inputClass} min-h-24 w-full`}
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <div className="text-right">
            <button
              type="submit"
              disabled={!commentText.trim() || busy}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Post comment'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}