import { PRIORITY_LABELS, STATUS_LABELS } from '../api/labels'
import type { Priority, Status } from '../api/types'

const statusStyles: Record<Status, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-200 text-slate-600',
}

const priorityStyles: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-rose-100 text-rose-700',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}