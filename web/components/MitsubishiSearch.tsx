'use client'

import { useState, useRef, useEffect } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = (q: string) => {
    setQuery(q)
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
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        placeholder="三菱型式検索..."
        className="w-24 px-2 py-1 border border-red-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-red-50"
      />
      {loading && <span className="absolute right-2 top-1.5 text-gray-400 text-xs">...</span>}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => select(r)}
              className="w-full text-left px-3 py-2 hover:bg-red-50 border-b border-gray-100 last:border-0"
            >
              <div className="text-xs font-mono text-red-700">{r.code}</div>
              <div className="text-xs text-gray-400">{r.category}</div>
              {r.price != null && <div className="text-xs text-gray-600 mt-0.5">¥{r.price.toLocaleString()}（税別）</div>}
            </button>
          ))}
        </div>
      )}
      {open && query && !loading && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400">
          {error ? '取得に失敗しました' : '該当なし'}
        </div>
      )}
    </div>
  )
}
