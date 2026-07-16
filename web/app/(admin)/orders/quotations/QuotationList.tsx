'use client'

import { useState } from 'react'
import { Quotation, QuotationStatus } from '@/lib/supabase/types'
import Link from 'next/link'
import { useSidebar } from '@/lib/sidebar-context'

const STATUS_COLORS: Record<QuotationStatus, string> = {
  '作成中': 'bg-blue-50 text-blue-700 border border-blue-200',
  '確定': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  '失注': 'bg-red-50 text-red-600 border border-red-200',
}

type SortKey = 'new' | 'old' | 'amount'

interface QuotationWithProject extends Quotation {
  projects?: { name: string; companies?: { name: string } | null } | null
}

export default function QuotationList({ initialQuotations }: { initialQuotations: QuotationWithProject[] }) {
  const openSidebar = useSidebar()
  const [filterStatus, setFilterStatus] = useState<QuotationStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('new')

  const displayed = initialQuotations
    .filter(q => filterStatus === 'all' || q.status === filterStatus)
    .filter(q => !search || q.doc_no.includes(search) || q.projects?.name.includes(search) || q.projects?.companies?.name.includes(search))
    .slice()
    .sort((a, b) => {
      if (sort === 'amount') return b.total_amount - a.total_amount
      if (sort === 'old') return a.issue_date.localeCompare(b.issue_date)
      return b.issue_date.localeCompare(a.issue_date)
    })

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={openSidebar} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900">見積書</h1>
            <p className="text-xs text-gray-500 mt-0.5">見積書の作成・確認・管理</p>
          </div>
        </div>
        <Link href="/orders/quotations/new"
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow whitespace-nowrap shrink-0">
          ＋ 新規見積書
        </Link>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="見積番号・取引先名・案件名で検索"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1">
          {(['all', '作成中', '確定', '失注'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {s === 'all' ? 'すべて' : s}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="new">新しい順</option>
          <option value="old">古い順</option>
          <option value="amount">金額が高い順</option>
        </select>
      </div>

      <div className="text-xs text-gray-500 mb-2">{displayed.length}件</div>

      {displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">見積書がありません</div>
      ) : (
        <>
        {/* PC: 一覧表示 */}
        <div className="hidden lg:block border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="grid [grid-template-columns:120px_1fr_1fr_104px_128px_88px_64px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500">
            <div>見積番号</div>
            <div>取引先</div>
            <div>案件名</div>
            <div>発行日</div>
            <div className="text-right">金額</div>
            <div>状態</div>
            <div />
          </div>
          <div className="divide-y divide-gray-100">
            {displayed.map(q => (
              <Link key={q.id} href={`/orders/quotations/${q.id}`}
                className="grid [grid-template-columns:120px_1fr_1fr_104px_128px_88px_64px] gap-2 items-center px-3 py-2.5 hover:bg-blue-50 transition-colors"
              >
                <div className="text-xs text-gray-500 truncate">{q.doc_no || '—'}</div>
                <div className="text-sm text-gray-600 truncate" title={q.projects?.companies?.name || undefined}>
                  {q.projects?.companies?.name || '—'}
                </div>
                <div className="text-sm font-semibold text-gray-900 truncate" title={q.projects?.name || undefined}>
                  {q.projects?.name || '—'}
                </div>
                <div className="text-xs text-gray-500">{q.issue_date}</div>
                <div className="text-right text-sm font-medium text-gray-900 tabular-nums">¥{q.total_amount.toLocaleString()}</div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[q.status]}`}>{q.status}</span>
                </div>
                <div className="text-right text-sm text-blue-600 font-medium whitespace-nowrap">詳細 ›</div>
              </Link>
            ))}
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="lg:hidden space-y-2">
          {displayed.map(q => (
            <Link key={q.id} href={`/orders/quotations/${q.id}`}
              className="block bg-white border border-gray-200 rounded-lg shadow-sm p-3 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate" title={q.projects?.name || undefined}>
                  {q.projects?.name || '—'}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${STATUS_COLORS[q.status]}`}>{q.status}</span>
              </div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{q.projects?.companies?.name || '—'}</div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <span>{q.doc_no || '見積番号未設定'}</span>
                <span>・</span>
                <span>{q.issue_date}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-base font-medium text-gray-900 tabular-nums">¥{q.total_amount.toLocaleString()}</div>
                <div className="text-xs text-blue-600 font-medium">詳細を見る ›</div>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
