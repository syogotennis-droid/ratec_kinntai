'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Win2kResult } from '@/lib/win2k'

interface Props {
  onSelect: (result: Win2kResult) => void
}

export default function MitsubishiSearch({ onSelect }: Props) {
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
    // テーブルの横スクロールなど祖先要素のスクロールで位置がズレるため閉じる。
    // ただしドロップダウン自身のスクロール(候補一覧内)は対象外にする。
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

  const search = (q: string) => {
    setQuery(q)
    setHighlightIndex(-1)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/win2k-search?kwd=${encodeURIComponent(q)}`)
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
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="三菱型式検索..."
        className="w-24 px-2 py-1 border border-red-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-red-50"
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
                  i === highlightIndex ? 'bg-red-50' : 'hover:bg-red-50'
                }`}
              >
                <div className="text-xs font-mono text-red-700">{r.code}</div>
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
