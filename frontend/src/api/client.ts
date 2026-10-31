import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens'

// Backend address. Override with VITE_API_URL in a frontend/.env file when you deploy.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// Fired when the session is really over (refresh failed). The app listens for it in F4.
export const AUTH_LOGOUT_EVENT = 'auth:logout'

// Our own error type, so pages can read the status code and the server's message.
// (Fields are declared by hand because the template disallows constructor shortcuts.)
export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(`API error ${status}`)
    this.status = status
    this.data = data
  }
}

// If several requests fail with 401 at once, they must share ONE refresh call.
let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false
  try {
    const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setTokens(data.access, data.refresh) // data.refresh is undefined unless rotation is on
    return true
  } catch {
    return false
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean // false for login/register, which have no token yet
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options

  // Builds and sends the request. Called again after a token refresh.
  const send = () => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = getAccessToken()
    if (auth && token) headers.Authorization = `Bearer ${token}`
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await send()

  // 401 = missing or expired token. Try once to get a new one, then repeat the request.
  if (res.status === 401 && auth) {
    if (await refreshOnce()) {
      res = await send()
    } else {
      clearTokens()
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
    }
  }

  if (res.status === 204) return undefined as T

  // Read as text first: an error page from the server might not be JSON.
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

// Turns any error into a short message for the UI.
// DRF sends errors as {"detail": "..."} or {"field": ["message"]}.
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const d = err.data
    if (d && typeof d === 'object') {
      const obj = d as Record<string, unknown>
      if (typeof obj.detail === 'string') return obj.detail
      const parts = Object.entries(obj).map(
        ([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : String(value)}`,
      )
      if (parts.length) return parts.join(' | ')
    }
    return `Request failed (${err.status})`
  }
  // fetch throws a TypeError when the server is down or CORS blocks the call
  if (err instanceof TypeError) return 'Cannot reach the server. Is the backend running?'
  return 'Something went wrong'
}