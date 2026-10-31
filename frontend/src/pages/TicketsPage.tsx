import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { PRIORITY_LABELS, STATUS_LABELS } from '../api/labels'
import { listTickets } from '../api/tickets'
import type { Paginated, Ticket } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { PriorityBadge, StatusBadge } from '../components/Badges'
import { useDebounce } from '../hooks/useDebounce'

const PAGE_SIZE = 10 // must match PAGE_SIZE in the backend settings

// "key" records which query this result belongs to, so we can tell when it is stale
interface LoadState {
  key: string
  data?: Paginated<Ticket>
  error?: string
}

export default function TicketsPage() {
  const { user } = useAuth()

  // Filter state
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [ordering, setOrdering] = useState('-created_at')
  const [page, setPage] = useState(1)
  const [state, setState] = useState<LoadState>({ key: '' })

  const debouncedSearch = useDebounce(search.trim())

  // The query string is the single source of truth: if it changes, we reload.
  const params = new URLSearchParams()
  if (debouncedSearch) params.set('search', debouncedSearch)
  if (status) params.set('status', status)
  if (priority) params.set('priority', priority)
  params.set('ordering', ordering)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()

  useEffect(() => {
    let cancelled = false // set when the query changes before this request finishes
    listTickets(query)
      .then((data) => {
        if (!cancelled) setState({ key: query, data })
      })
      .catch((err) => {
        if (!cancelled) setState({ key: query, error: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [query])

  // "Loading" means: the result we hold is for an older query
  const loading = state.key !== query
  const { data, error } = state
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1
  const showCreator = user?.role !== 'customer'
  const title =
    user?.role === 'admin' ? 'All tickets' : user?.role === 'agent' ? 'Assigned to me' : 'My tickets'
  const hasFilters = search !== '' || status !== '' || priority !== '' || ordering !== '-created_at'

  function clearFilters() {
    setSearch('')
    setStatus('')
    setPriority('')
    setOrdering('-created_at')
    setPage(1)
  }

  // Any filter change goes back to page 1, otherwise we might land on a page that no longer exists.
  const inputClass = 'rounded border border-slate-300 bg-white p-2 text-sm'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        <Link
          to="/tickets/new"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New ticket
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow">
        <input
          className={`${inputClass} min-w-48 flex-1`}
          placeholder="Search title or description..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <select
          className={inputClass}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={ordering}
          onChange={(e) => {
            setOrdering(e.target.value)
            setPage(1)
          }}
        >
          <option value="-created_at">Newest first</option>
          <option value="created_at">Oldest first</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-indigo-600 hover:underline">
            Clear
          </button>
        )}
      </div>

      {!loading && error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!data && loading && <p className="p-8 text-center text-slate-500">Loading tickets...</p>}

      {data && (
        <div className={`overflow-x-auto rounded-xl bg-white shadow ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                {showCreator && <th className="px-4 py-3">Created by</th>}
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{t.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  {showCreator && <td className="px-4 py-3 text-slate-700">{t.created_by}</td>}
                  <td className="px-4 py-3 text-slate-700">{t.assigned_to ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {data.results.length === 0 && (
                <tr>
                  <td colSpan={showCreator ? 7 : 6} className="px-4 py-10 text-center text-slate-500">
                    No tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.count > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} · {data.count} ticket{data.count === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!data.previous || loading}
              className="rounded border bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.next || loading}
              className="rounded border bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}