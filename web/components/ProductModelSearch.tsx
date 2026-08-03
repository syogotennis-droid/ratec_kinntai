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

const DROPDOWN_WIDTH = 260
const VISIBLE_ITEMS = 5
const ITEM_EST_HEIGHT = 62

interface Props {
  makers: Maker[]
  onSelect: (result: Win2kResult, maker: Maker) => void
}

// 「-」だけ、空文字だけの商品名・仕様行はノイズになるため非表示にする
function isMeaningfulText(v: string | null | undefined): v is string {
  return !!v && v.trim() !== '' && v.trim() !== '-'
}

// 検索文字に一致する部分を軽く強調表示する
function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (idx === -1) return text
  const end = idx + query.trim().length
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200/80 text-inherit rounded-sm px-0.5">{text.slice(idx, end)}</mark>
      {text.slice(end)}
    </>
  )
}

export default function ProductModelSearch({ makers, onSelect }: Props) {
  const [maker, setMaker] = useState<Maker>(makers[0])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Win2kResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: DROPDOWN_WIDTH })
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const accent = ACCENT[maker.accent]

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
    if (!open || isMobile) return
    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open, isMobile])

  useEffect(() => {
    if (highlightIndex < 0) return
    // ページ/ウィンドウ側までスクロールさせるとscrollイベントが発火しドロップダウンが
    // 閉じてしまうため、scrollIntoViewは使わずドロップダウン内部のスクロールだけを動かす
    const container = dropdownRef.current
    const item = itemRefs.current[highlightIndex]
    if (!container || !item) return
    const itemTop = item.offsetTop
    const itemBottom = itemTop + item.offsetHeight
    if (itemTop < container.scrollTop) {
      container.scrollTop = itemTop
    } else if (itemBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = itemBottom - container.clientHeight
    }
  }, [highlightIndex])

  const updatePosition = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (!rect) return
    const desiredHeight = VISIBLE_ITEMS * ITEM_EST_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow
    setPos(openUpward
      ? { left: rect.left, width: Math.max(rect.width, DROPDOWN_WIDTH), bottom: window.innerHeight - rect.top + 4 }
      : { left: rect.left, width: Math.max(rect.width, DROPDOWN_WIDTH), top: rect.bottom + 4 }
    )
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
    onSelect(r, maker)
    setQuery('')
    setResults([])
    setOpen(false)
    setHighlightIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (results.length === 0) return
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
    }
    // Tabキーはブラウザ標準の挙動に任せ、ここでは何もしない
  }

  const resultRows = (compact: boolean) => {
    if (results.length > 0) {
      return results.map((r, i) => {
        const category = isMeaningfulText(r.category) ? r.category : null
        return (
          <button
            key={i}
            ref={el => { itemRefs.current[i] = el }}
            type="button"
            onMouseDown={e => { e.preventDefault(); select(r) }}
            onMouseEnter={() => setHighlightIndex(i)}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-0 transition-colors ${
              i === highlightIndex ? 'bg-blue-50' : 'hover:bg-blue-50'
            }`}
          >
            <div className={`font-semibold ${compact ? 'text-sm' : 'text-xs'} text-gray-900 font-mono`}>
              {highlightMatch(r.code, query)}
            </div>
            {category && (
              <div className={`${compact ? 'text-xs' : 'text-[11px]'} text-gray-600 mt-0.5 truncate`}>{category}</div>
            )}
            {r.price != null && (
              <div className={`${compact ? 'text-xs' : 'text-[11px]'} text-gray-400 mt-0.5`}>
                希望小売価格 ¥{r.price.toLocaleString()}（税別）
              </div>
            )}
          </button>
        )
      })
    }
    if (loading) {
      return <div className="px-3 py-3 text-xs text-gray-400">検索中...</div>
    }
    if (query) {
      return <div className="px-3 py-3 text-xs text-gray-400">{error ? '取得に失敗しました' : '一致する型式がありません'}</div>
    }
    return null
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
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) { updatePosition(); setOpen(true) } }}
          placeholder={`${maker.label}型式検索...`}
          className={`w-24 px-2 py-1 border ${accent.border} rounded text-xs focus:outline-none focus:ring-1 ${accent.ring} ${accent.bg}`}
        />
        {loading && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400" aria-label="検索中">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          // スマホ: 画面幅いっぱいのボトムシートで候補を表示
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}>
            <div
              ref={dropdownRef}
              onClick={e => e.stopPropagation()}
              className="thin-scrollbar absolute inset-x-0 bottom-0 bg-white border-t border-gray-200 rounded-t-2xl shadow-xl max-h-[60vh] overflow-y-auto"
            >
              <div className="flex justify-center pt-2 pb-1 sticky top-0 bg-white">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-3 pb-2 text-xs font-medium text-gray-500 sticky top-3 bg-white">
                {maker.label} 「{query}」の検索結果
              </div>
              {resultRows(true)}
            </div>
          </div>
        ) : (
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
            className="thin-scrollbar z-30 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto"
          >
            <div style={{ maxHeight: VISIBLE_ITEMS * ITEM_EST_HEIGHT }}>
              {resultRows(false)}
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  )
}
