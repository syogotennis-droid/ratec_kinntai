'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Quotation, QuotationStatus } from '@/lib/supabase/types'
import Link from 'next/link'

const STATUS_COLORS: Record<QuotationStatus, string> = {
  '作成中': 'bg-gray-100 text-gray-600',
  '確定': 'bg-green-100 text-green-700',
  '失注': 'bg-red-100 text-red-600',
}

interface QuotationWithProject extends Quotation {
  projects?: { name: string; companies?: { name: string } | null } | null
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<QuotationStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient()
      .from('quotations')
      .select('*, projects(name, companies(name))')
      .order('issue_date', { ascending: false })
    setQuotations(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  const displayed = quotations
    .filter(q => filterStatus === 'all' || q.status === filterStatus)
    .filter(q => !search || q.doc_no.includes(search) || q.projects?.name.includes(search) || q.projects?.companies?.name.includes(search))

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="番号・案件名で検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <Link href="/orders/quotations/new"
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap">
          + 新規
        </Link>
      </div>

      <div className="flex gap-1 mb-3">
        {(['all', '作成中', '確定', '失注'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s === 'all' ? '全て' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">見積書がありません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(q => (
            <Link key={q.id} href={`/orders/quotations/${q.id}`}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors block">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 shrink-0">{q.doc_no}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {q.projects?.companies?.name} / {q.projects?.name}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{q.issue_date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-gray-900">¥{q.total_amount.toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]}`}>
                  {q.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
