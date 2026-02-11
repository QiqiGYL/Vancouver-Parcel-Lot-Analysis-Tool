import { useEffect, useState } from 'react'

/** Return a debounced value. */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debouncedValue
}
