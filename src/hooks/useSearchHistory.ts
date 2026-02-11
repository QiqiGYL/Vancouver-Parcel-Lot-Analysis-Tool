import { useCallback, useState } from 'react'
import type { SearchHistoryItem } from '@/types'

const STORAGE_KEY = 'unlockland-search-history'
const MAX_HISTORY = 20

function loadHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(items: SearchHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
  } catch {
    // ignore
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>(loadHistory)

  const addToHistory = useCallback((address: string, siteId: string) => {
    setHistory((prev) => {
      const next = [
        { address, siteId, timestamp: Date.now() },
        ...prev.filter((h) => h.siteId !== siteId),
      ].slice(0, MAX_HISTORY)
      saveHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  return { history, addToHistory, clearHistory }
}
