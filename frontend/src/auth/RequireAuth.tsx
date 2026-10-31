import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

// Wraps every page that needs a login. Not logged in -> go to /login.
export default function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Without this, a page refresh would flash the login page while we check the token
  if (loading) return <p className="p-8 text-center text-slate-500">Loading...</p>

  // "state" remembers where they wanted to go, so login can send them back there
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet /> // render the child route
}