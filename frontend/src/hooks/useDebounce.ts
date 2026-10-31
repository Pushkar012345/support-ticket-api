import { useEffect, useState } from 'react'

// Returns the value only after it has stopped changing for `delay` ms.
// Without this, typing "login" would send 5 requests, one per letter.
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id) // typing again cancels the previous timer
  }, [value, delay])

  return debounced
}