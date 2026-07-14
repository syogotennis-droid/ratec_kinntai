'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PurchaseOrder } from '@/lib/supabase/types'
import Link from 'next/link'
import { useSidebar } from '@/lib/sidebar-context'

interface POWithProject extends PurchaseOrder {
  projects?: { name: string; companies?: { name: string } | null } | null
  suppliers?: { name: string } | null
}

export default function PurchaseOrdersPage() {
  const openSidebar = useSidebar()
  const [orders, setOrders] = useState<POWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient()
      .from('purchase_orders')
      .select('*, projects(name, companies(name)), suppliers(name)')
      .order('issue_date', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const displayed = orders.filter(o =>
    !search || o.doc_no.includes(search) || o.projects?.name.includes(search) || o.projects?.companies?.name.includes(search)
  )

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={openSidebar} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="番号・工事名で検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <Link href="/orders/purchase-orders/new"
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap">
          + 新規
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">注文書がありません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(o => (
            <Link key={o.id} href={`/orders/purchase-orders/${o.id}`}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors block">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 shrink-0">{o.doc_no}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{o.projects?.companies?.name} / {o.projects?.name}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{o.issue_date} · {o.suppliers?.name ?? '仕入先未設定'}</p>
              </div>
              <div className="text-sm font-medium text-gray-900 shrink-0">¥{o.total_amount.toLocaleString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
