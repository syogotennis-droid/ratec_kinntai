'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Win2kResult } from '@/lib/win2k'

export interface Maker {
  key: string
  label: string
  endpoint: string
  accent: 'red' | 'blue'
}

const ACCENT = {
  red: {
    border: 'border-red-300', ring: 'focus:ring-red-500', bg: 'bg-red-50',
    code: 'text-red-700', hover: 'hover:bg-red-50', hi: 'bg-red-50',
    on: 'bg-red-600 text-white', off: 'text-red-600 bg-white hover:bg-red-50',
  },
  blue: {
    border: 'border-blue-300', ring: 'focus:ring-blue-500', bg: 'bg-blue-50',
    code: 'text-blue-700', hover: 'hover:bg-blue-50', hi: 'bg-blue-50',
    on: 'bg-blue-600 text-white', off: 'text-blue-600 bg-white hover:bg-blue-50',
  },
} as const

interface Props {
  makers: Maker[]
  onSelect: (result: Win2kResult) => void
}

export default function ProductModelSearch({ makers, onSelect }: Props) {
  const [maker, setMaker] = useState<Maker>(makers[0])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Win2kResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const accent = ACCENT[maker.accent]

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (inputRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open])

  useEffect(() => {
    if (highlightIndex < 0) return
    itemRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  const updatePosition = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width })
  }

  const runSearch = (q: string, m: Maker) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`${m.endpoint}?kwd=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setResults(data.results ?? [])
      } catch {
        setError(true)
        setResults([])
      } finally {
        updatePosition()
        setOpen(true)
        setLoading(false)
      }
    }, 400)
  }

  const search = (q: string) => {
    setQuery(q)
    setHighlightIndex(-1)
    runSearch(q, maker)
  }

  const changeMaker = (m: Maker) => {
    setMaker(m)
    setHighlightIndex(-1)
    setResults([])
    if (query) runSearch(query, m)
  }

  const select = (r: Win2kResult) => {
    onSelect(r)
    setQuery('')
    setResults([])
    setOpen(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0) {
        e.preventDefault()
        select(results[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      {makers.length > 1 && (
        <div className="flex rounded overflow-hidden border border-gray-200 mb-1 w-fit text-[10px] font-medium">
          {makers.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => changeMaker(m)}
              className={`px-2 py-0.5 transition-colors ${maker.key === m.key ? ACCENT[m.accent].on : ACCENT[m.accent].off}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`${maker.label}型式検索...`}
        className={`w-24 px-2 py-1 border ${accent.border} rounded text-xs focus:outline-none focus:ring-1 ${accent.ring} ${accent.bg}`}
      />
      {loading && <span className="absolute right-2 top-1.5 text-gray-400 text-xs">...</span>}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: Math.max(pos.width, 320) }}
          className="z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {results.length > 0 ? (
            results.map((r, i) => (
              <button
                key={i}
                ref={el => { itemRefs.current[i] = el }}
                onClick={() => select(r)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 ${
                  i === highlightIndex ? accent.hi : accent.hover
                }`}
              >
                <div className={`text-xs font-mono ${accent.code}`}>{r.code}</div>
                <div className="text-xs text-gray-400">{r.category}</div>
                {r.price != null && <div className="text-xs text-gray-600 mt-0.5">¥{r.price.toLocaleString()}（税別）</div>}
              </button>
            ))
          ) : query && !loading ? (
            <div className="px-3 py-2 text-xs text-gray-400">{error ? '取得に失敗しました' : '該当なし'}</div>
          ) : null}
        </div>,
        document.body
      )}
    </div>
  )
}
