'use client'

import { useState } from 'react'
import { Invoice, InvoiceStatus } from '@/lib/supabase/types'
import Link from 'next/link'
import { useSidebar } from '@/lib/sidebar-context'

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  '下書き': 'bg-gray-100 text-gray-600',
  '発行済': 'bg-blue-100 text-blue-700',
  '送付済': 'bg-yellow-100 text-yellow-700',
  '入金済': 'bg-green-100 text-green-700',
}

interface InvoiceWithCompany extends Invoice {
  projects?: { name: string; companies?: { name: string } | null } | null
}

export default function InvoiceList({ initialInvoices }: { initialInvoices: InvoiceWithCompany[] }) {
  const openSidebar = useSidebar()
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const displayed = initialInvoices
    .filter(i => filterStatus === 'all' || i.status === filterStatus)
    .filter(i => !search || i.doc_no.includes(search) || i.projects?.name.includes(search) || i.projects?.companies?.name.includes(search))

  const totalAmount = displayed.filter(i => i.status !== '下書き').reduce((s, i) => s + i.total_amount, 0)

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={openSidebar} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="番号・案件名で検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <Link href="/orders/invoices/new"
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap">
          + 新規
        </Link>
      </div>
      <div className="flex gap-1 mb-3 flex-wrap">
        {(['all', '下書き', '発行済', '送付済', '入金済'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s === 'all' ? '全て' : s}
          </button>
        ))}
      </div>
      {filterStatus !== '下書き' && filterStatus !== 'all' && (
        <p className="text-xs text-gray-500 mb-3">合計 ¥{totalAmount.toLocaleString()}</p>
      )}
      {displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">請求書がありません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(inv => (
            <Link key={inv.id} href={`/orders/invoices/${inv.id}`}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors block">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 shrink-0">{inv.doc_no}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.projects?.companies?.name} / {inv.projects?.name}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{inv.issue_date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-gray-900">¥{inv.total_amount.toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
