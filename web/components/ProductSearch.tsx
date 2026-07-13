'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/supabase/types'

interface Props {
  onSelect: (product: Product) => void
}

export default function ProductSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
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
      const { data } = await createClient()
        .from('products')
        .select('*')
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .order('code')
        .limit(10)
      setResults(data ?? [])
      setOpen(true)
      setLoading(false)
    }, 250)
  }

  const select = (p: Product) => {
    onSelect(p)
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
        placeholder="品番検索..."
        className="w-24 px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50"
      />
      {loading && <span className="absolute right-2 top-1.5 text-gray-400 text-xs">...</span>}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => select(p)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <div className="text-xs font-mono text-blue-700">{p.code}</div>
              <div className="text-xs text-gray-900">{p.name}</div>
              {p.spec && <div className="text-xs text-gray-400">{p.spec}</div>}
              <div className="text-xs text-gray-600 mt-0.5">¥{p.unit_price.toLocaleString()} / {p.unit}　{p.maker}</div>
            </button>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && !loading && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400">
          該当なし
        </div>
      )}
    </div>
  )
}
