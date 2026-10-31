import { Link, Outlet } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/useAuth'

const roleStyles: Record<Role, string> = {
  admin: 'bg-rose-100 text-rose-700',
  agent: 'bg-amber-100 text-amber-700',
  customer: 'bg-emerald-100 text-emerald-700',
}

// Top bar shown on every logged-in page. <Outlet /> is where the page itself appears.
export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-indigo-600">
            Support Ticket Desk
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-700">{user?.username}</span>
            {user && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleStyles[user.role]}`}>
                {user.role}
              </span>
            )}
            <button
              onClick={() => signOut()}
              className="rounded border px-3 py-1 text-slate-700 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}