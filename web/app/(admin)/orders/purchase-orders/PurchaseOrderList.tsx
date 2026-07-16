'use client'

import { useState } from 'react'
import { PurchaseOrder } from '@/lib/supabase/types'
import Link from 'next/link'
import { useSidebar } from '@/lib/sidebar-context'

type SortKey = 'new' | 'old' | 'amount_high' | 'amount_low'

interface POWithProject extends PurchaseOrder {
  projects?: { name: string; companies?: { name: string } | null } | null
  suppliers?: { name: string } | null
}

function SupplierBadge({ name }: { name?: string | null }) {
  if (name) return <span className="block text-sm text-gray-700 truncate" title={name}>{name}</span>
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-amber-50 text-amber-700 border border-amber-200">
      仕入先未設定
    </span>
  )
}

export default function PurchaseOrderList({ initialOrders }: { initialOrders: POWithProject[] }) {
  const openSidebar = useSidebar()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('new')

  const displayed = initialOrders
    .filter(o =>
      !search ||
      o.doc_no.includes(search) ||
      o.projects?.name.includes(search) ||
      o.projects?.companies?.name.includes(search) ||
      o.suppliers?.name.includes(search)
    )
    .slice()
    .sort((a, b) => {
      if (sort === 'amount_high') return b.total_amount - a.total_amount
      if (sort === 'amount_low') return a.total_amount - b.total_amount
      if (sort === 'old') return a.issue_date.localeCompare(b.issue_date)
      return b.issue_date.localeCompare(a.issue_date)
    })

  const isFiltered = search.trim() !== ''

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
            <h1 className="text-lg md:text-xl font-bold text-gray-900">注文書</h1>
            <p className="text-xs text-gray-500 mt-0.5">仕入先への注文書を作成・管理します</p>
          </div>
        </div>
        <Link href="/orders/purchase-orders/new"
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow whitespace-nowrap shrink-0">
          ＋ 新規注文書
        </Link>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="注文番号・案件名・取引先名・仕入先名で検索"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs text-gray-500">{displayed.length}件</span>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="new">作成日が新しい順</option>
          <option value="old">作成日が古い順</option>
          <option value="amount_high">金額が高い順</option>
          <option value="amount_low">金額が低い順</option>
        </select>
      </div>

      {displayed.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500">{isFiltered ? '該当する注文書がありません' : '注文書がありません'}</p>
          {!isFiltered && (
            <Link href="/orders/purchase-orders/new"
              className="inline-block mt-3 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow">
              ＋ 新規注文書を作成
            </Link>
          )}
        </div>
      ) : (
        <>
        {/* PC: 一覧表示 */}
        <div className="hidden lg:block border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="grid [grid-template-columns:112px_1fr_1fr_144px_96px_128px_64px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500">
            <div>注文番号</div>
            <div>案件名</div>
            <div>取引先</div>
            <div>仕入先</div>
            <div>作成日</div>
            <div className="text-right">金額</div>
            <div />
          </div>
          <div className="divide-y divide-gray-100">
            {displayed.map(o => (
              <Link key={o.id} href={`/orders/purchase-orders/${o.id}`}
                className="grid [grid-template-columns:112px_1fr_1fr_144px_96px_128px_64px] gap-2 items-center px-3 py-2.5 hover:bg-blue-50 transition-colors"
              >
                <div className="text-sm text-gray-600 truncate">{o.doc_no || '—'}</div>
                <div className="text-sm font-semibold text-gray-900 truncate" title={o.projects?.name || undefined}>
                  {o.projects?.name || '—'}
                </div>
                <div className="text-sm text-gray-500 truncate" title={o.projects?.companies?.name || undefined}>
                  {o.projects?.companies?.name || '—'}
                </div>
                <div className="min-w-0">
                  <SupplierBadge name={o.suppliers?.name} />
                </div>
                <div className="text-xs text-gray-500">{o.issue_date}</div>
                <div className="text-right text-sm font-medium text-gray-900 tabular-nums">¥{o.total_amount.toLocaleString()}</div>
                <div className="text-right text-sm text-blue-600 font-medium whitespace-nowrap">詳細 ›</div>
              </Link>
            ))}
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="lg:hidden space-y-2">
          {displayed.map(o => (
            <Link key={o.id} href={`/orders/purchase-orders/${o.id}`}
              className="block bg-white border border-gray-200 rounded-lg shadow-sm p-3 hover:shadow-md transition-all"
            >
              <div className="text-sm font-semibold text-gray-900 truncate" title={o.projects?.name || undefined}>
                {o.projects?.name || '—'}
              </div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{o.projects?.companies?.name || '—'}</div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <span>{o.doc_no || '注文番号未設定'}</span>
                <span>・</span>
                <span>{o.issue_date}</span>
              </div>
              <div className="mt-1.5">
                <SupplierBadge name={o.suppliers?.name} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-base font-medium text-gray-900 tabular-nums">¥{o.total_amount.toLocaleString()}</div>
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
