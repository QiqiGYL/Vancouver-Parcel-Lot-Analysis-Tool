import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchHistory } from '@/hooks/useSearchHistory'
import type { ParcelFeature } from '@/types'

export interface AddressCandidate {
  address: string
  siteId: string
  feature: ParcelFeature
}

interface AddressSearchProps {
  query: string
  onQueryChange: (q: string) => void
  candidates: AddressCandidate[]
  onSelect: (feature: ParcelFeature) => void
  getFeatureBySiteId: (siteId: string) => ParcelFeature | null
  placeholder?: string
}

export function AddressSearch({
  query,
  onQueryChange,
  candidates,
  onSelect,
  getFeatureBySiteId,
  placeholder = 'Search address in Vancouver…',
}: AddressSearchProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const { history, addToHistory, clearHistory } = useSearchHistory()

  const showHistory = open && !query.trim()
  const maxIndex = showHistory ? history.length - 1 : candidates.length - 1

  const setHighlightSafe = useCallback(
    (next: number) => {
      setHighlightIndex(() => Math.max(0, Math.min(next, maxIndex)))
    },
    [maxIndex]
  )

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, showHistory])

  useEffect(() => {
    if (highlightIndex <= maxIndex && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, maxIndex])

  const handleSelect = useCallback(
    (item: { address: string; siteId: string; feature?: ParcelFeature }) => {
      const feature = item.feature ?? getFeatureBySiteId(item.siteId)
      if (feature) {
        addToHistory(item.address, item.siteId)
        onSelect(feature)
      }
      onQueryChange('')
      setOpen(false)
      inputRef.current?.blur()
    },
    [addToHistory, getFeatureBySiteId, onSelect, onQueryChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open && e.key !== 'Escape') return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setOpen(true)
          setHighlightSafe(highlightIndex + 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          setOpen(true)
          setHighlightSafe(highlightIndex - 1)
          break
        case 'Enter':
          e.preventDefault()
          if (showHistory && history[highlightIndex]) {
            handleSelect(history[highlightIndex])
          } else if (!showHistory && candidates[highlightIndex]) {
            handleSelect(candidates[highlightIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          setHighlightIndex(0)
          inputRef.current?.blur()
          break
        default:
          break
      }
    },
    [open, showHistory, history, candidates, highlightIndex, setHighlightSafe, handleSelect]
  )

  const displayList = showHistory
    ? history
    : candidates.map((c) => ({ address: c.address, siteId: c.siteId, feature: c.feature }))

  return (
    <div className="address-search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Address search"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul ref={listRef} role="listbox" className="address-search-list">
          {showHistory && (
            <li className="address-search-header">
              <span>Recent</span>
              <button
                type="button"
                className="address-search-clear-history"
                onClick={() => clearHistory()}
              >
                Clear history
              </button>
            </li>
          )}
          {displayList.length === 0 && (
            <li className="address-search-empty">No results</li>
          )}
          {displayList.map((item, i) => (
            <li
              key={item.siteId + (item.address || '')}
              role="option"
              aria-selected={i === highlightIndex}
              className={i === highlightIndex ? 'address-search-item active' : 'address-search-item'}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(item)
              }}
            >
              {item.address || item.siteId}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
