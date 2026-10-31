import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { PRIORITY_LABELS } from '../api/labels'
import { createTicket } from '../api/tickets'
import type { Priority } from '../api/types'

const TITLE_MAX = 200 // matches max_length on the backend Ticket.title

export default function NewTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return // guards against a double click creating two tickets

    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    // `required` lets "   " through, so check again after trimming
    if (!cleanTitle || !cleanDescription) {
      setError('Title and description are required.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
           const created = await createTicket({ title: cleanTitle, description: cleanDescription, priority })
      navigate(`/tickets/${created.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false) // only re-enable on failure; on success we leave the page
    }
  }

  const inputClass = 'mt-1 w-full rounded border border-slate-300 bg-white p-2'

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-xl font-semibold text-slate-800">New ticket</h2>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder="Short summary of the problem"
            required
          />
          <span className="mt-1 block text-right text-xs text-slate-400">
            {title.length}/{TITLE_MAX}
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            className={`${inputClass} min-h-40`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? What did you expect? Any error message?"
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Priority
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-end gap-3">
          <Link to="/" className="text-sm text-slate-600 hover:underline">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}