'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Quotation, QuotationItem, Project, QuotationStatus, Settings } from '@/lib/supabase/types'
import Link from 'next/link'
import { downloadQuotationExcel } from '@/lib/excel/quotation'
import ProductModelSearch, { Maker } from '@/components/ProductModelSearch'
import { Win2kResult } from '@/lib/win2k'
import { buildWin2kName } from '@/lib/win2k-name'

const MAKERS: Maker[] = [
  { key: 'mitsubishi', label: '三菱', endpoint: '/api/win2k-search', accent: 'red' },
  { key: 'toshiba', label: '東芝', endpoint: '/api/toshiba-search', accent: 'blue' },
]

const SPEC_ENDPOINTS: Record<string, string> = {
  mitsubishi: '/api/win2k-spec',
  toshiba: '/api/toshiba-spec',
}
import { useProfile } from '@/lib/profile-context'

const TAX_RATE = 0.1
const STATUSES: QuotationStatus[] = ['作成中', '確定', '失注']
const STATUS_SELECT_STYLES: Record<QuotationStatus, string> = {
  '作成中': 'bg-blue-50 text-blue-700 border-blue-200',
  '確定': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '失注': 'bg-red-50 text-red-600 border-red-200',
}

const ITEM_GRID_COLS = '[grid-template-columns:76px_170px_1fr_72px_112px_76px_112px_120px_40px]'

// 品名はExcel上は1セル(改行区切り2行)だが、システム上は品名・型番を分けて入力できるようにする
function splitName(name: string): [string, string] {
  const idx = name.indexOf('\n')
  return idx === -1 ? [name, ''] : [name.slice(0, idx), name.slice(idx + 1)]
}
function joinName(line1: string, line2: string): string {
  return line2 ? `${line1}\n${line2}` : line1
}

interface FullQuotation extends Quotation {
  items: QuotationItem[]
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.6 12.2A2 2 0 0114.4 21H9.6a2 2 0 01-2-1.8L7 7h10z" />
    </svg>
  )
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const profile = useProfile()
  const [quotation, setQuotation] = useState<FullQuotation | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [projectId, setProjectId] = useState<number>(0)
  const [supplierId, setSupplierId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [status, setStatus] = useState<QuotationStatus>('作成中')
  const [contactPerson, setContactPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<QuotationItem, 'id'>[]>([])
  const [itemLinks, setItemLinks] = useState<(string | null)[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [qRes, projectsRes, settingsRes] = await Promise.all([
      supabase.from('quotations').select('*, items:quotation_items(*)').eq('id', id).single(),
      supabase.from('projects').select('*, companies(name)').order('name'),
      supabase.from('settings').select('*').single(),
    ])
    const q = qRes.data as FullQuotation | null
    setQuotation(q)
    setProjects(projectsRes.data ?? [])
    setSettings(settingsRes.data ?? null)
    if (q) {
      setProjectId(q.project_id)
      setSupplierId(q.supplier_id ?? 0)
      setDocNo(q.doc_no)
      setIssueDate(q.issue_date)
      setStatus(q.status)
      setContactPerson(q.contact_person ?? '')
      setNotes(q.notes ?? '')
      const sorted = [...(q.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(({ id: _id, ...rest }) => rest))
      setItemLinks(sorted.map(() => null))
      // 顧客名を取得
      const proj = (projectsRes.data ?? []).find(p => p.id === q.project_id)
      setCustomerName((proj as { companies?: { name: string } | null } | undefined)?.companies?.name ?? '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const subtotal = items.reduce((s, item) => s + item.amount, 0)
  const taxAmount = Math.floor(subtotal * TAX_RATE)
  const totalAmount = subtotal + taxAmount

  const handleExport = async () => {
    setError(null)
    setExporting(true)
    try {
      const proj = projects.find(p => p.id === projectId)
      await downloadQuotationExcel({
        docNo,
        issueDate,
        customerName: (proj as { companies?: { name: string } | null } | undefined)?.companies?.name ?? customerName,
        projectName: proj?.name ?? '',
        contactPerson: contactPerson || null,
        notes,
        items,
        subtotal,
        taxAmount,
        totalAmount,
        settings,
        handlerName: profile?.name,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Excel出力に失敗しました')
    } finally {
      setExporting(false)
    }
  }

  const applyWin2kResult = (idx: number, result: Win2kResult, maker: Maker) => {
    const name = buildWin2kName(maker.label, result)
    setItems(prev => {
      const next = [...prev]
      const unitPrice = result.price ?? next[idx].unit_price
      next[idx] = { ...next[idx], name, unit_price: unitPrice, amount: Math.round(next[idx].qty * unitPrice * next[idx].markup_rate) }
      return next
    })
    setItemLinks(prev => {
      const next = [...prev]
      next[idx] = result.detailUrl
      return next
    })

    // 検索結果だけでは品名情報が不十分なため、商品詳細ページから埋込穴・消費電力・
    // 製品タイプ名を追加取得できたら品名を補強する（LED照明器具のみ有効な項目のため失敗は無視）
    const specEndpoint = SPEC_ENDPOINTS[maker.key]
    if (specEndpoint && result.detailUrl) {
      fetch(`${specEndpoint}?detailUrl=${encodeURIComponent(result.detailUrl)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data?.spec) return
          const enrichedName = buildWin2kName(maker.label, result, data.spec)
          setItems(prev => {
            if (!prev[idx] || prev[idx].name !== name) return prev
            const next = [...prev]
            next[idx] = { ...next[idx], name: enrichedName }
            return next
          })
        })
        .catch(() => {})
    }
  }

  const updateItem = (idx: number, field: keyof Omit<QuotationItem, 'id'>, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [field]: value }
      if (field === 'qty' || field === 'unit_price' || field === 'markup_rate' || field === 'item_type') {
        item.amount = item.item_type === 'labor'
          ? Math.round(Number(item.qty) * Number(item.unit_price))
          : Math.round(Number(item.qty) * Number(item.unit_price) * Number(item.markup_rate))
      }
      next[idx] = item
      return next
    })
  }

  const addItem = () => {
    setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '式', unit_price: 0, amount: 0, markup_rate: 0.3, purchase_rate: 0.2, item_type: 'product' }])
    setItemLinks(prev => [...prev, null])
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setItemLinks(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('quotations').update({
        project_id: projectId,
        supplier_id: supplierId || null,
        doc_no: docNo,
        issue_date: issueDate,
        status,
        contact_person: contactPerson || null,
        notes: notes || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      }).eq('id', id)
      await supabase.from('quotation_items').delete().eq('quotation_id', Number(id))
      if (items.length > 0) {
        await supabase.from('quotation_items').insert(items.map((item, i) => ({ ...item, quotation_id: Number(id), sort_order: i })))
      }
      router.push('/orders/quotations')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    if (!confirm('削除しますか？')) return
    setSaving(true)
    try {
      await createClient().from('quotations').delete().eq('id', id)
      router.push('/orders/quotations')
    } catch {
      setError('削除に失敗しました')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-base text-gray-500">読み込み中...</div>
  if (!quotation) return <div className="p-6 text-base text-gray-500">見つかりません</div>

  return (
    <div className="p-4 max-w-[1180px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/orders/quotations" className="text-sm text-blue-600 hover:underline shrink-0">← 一覧へ戻る</Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">見積書編集</h1>
            <p className="text-sm text-gray-600 leading-tight mt-0.5">{docNo || '見積番号未設定'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleExport} disabled={exporting || saving}
            className="px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg">
            {exporting ? '出力中...' : 'Excel出力'}
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200"
              aria-label="その他の操作">
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                <button onClick={handleDelete} disabled={saving}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  この見積書を削除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="max-w-[1000px] mx-auto mb-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">案件名</label>
              <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
              <select value={status} onChange={e => setStatus(e.target.value as QuotationStatus)}
                className={`w-full px-3 py-2 border rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_SELECT_STYLES[status]}`}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">見積書番号</label>
              <input type="text" value={docNo} onChange={e => setDocNo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">発行日</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </div>

      {/* 明細 */}
      <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">明細</h2>
          <button onClick={addItem}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            + 行追加
          </button>
        </div>

        {/* PC: 一覧表示 */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className={`grid ${ITEM_GRID_COLS} gap-2 border-b border-gray-200 pb-2 text-xs font-medium text-gray-500`}>
              <div>種別</div>
              <div>
                <div>メーカー</div>
                <div className="text-gray-400 font-normal">型式検索</div>
              </div>
              <div>品名・型番</div>
              <div>数量</div>
              <div className="text-right">メーカー希望小売価格</div>
              <div>掛率</div>
              <div className="text-right">仕切り価格</div>
              <div className="text-right">金額</div>
              <div />
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const isLabor = item.item_type === 'labor'
                return (
                  <div key={idx} className={`grid ${ITEM_GRID_COLS} gap-2 items-start py-2`}>
                    <div>
                      <select value={item.item_type} onChange={e => updateItem(idx, 'item_type', e.target.value)}
                        className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="product">商品</option>
                        <option value="labor">作業</option>
                      </select>
                    </div>
                    <div>
                      {isLabor ? <span className="text-gray-300 text-sm">—</span> : <ProductModelSearch makers={MAKERS} onSelect={(r, m) => applyWin2kResult(idx, r, m)} />}
                    </div>
                    <div>
                      {isLabor ? (
                        <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      ) : (
                        <div className="flex items-start gap-1">
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <input value={splitName(item.name)[0]} onChange={e => updateItem(idx, 'name', joinName(e.target.value, splitName(item.name)[1]))}
                              placeholder="品名" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            <input value={splitName(item.name)[1]} onChange={e => updateItem(idx, 'name', joinName(splitName(item.name)[0], e.target.value))}
                              placeholder="型番" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          {itemLinks[idx] && (
                            <a href={itemLinks[idx]!} target="_blank" rel="noreferrer noopener" title="公式サイトの商品ページを開く"
                              className="shrink-0 p-1 mt-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                              <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12" />
                                <path d="M11 3h6v6" />
                                <path d="M9 11 17 3" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      {isLabor ? <span className="block text-right text-gray-300 text-sm py-1.5">—</span> : (
                        <>
                          <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <div className="text-right text-[11px] text-gray-400 mt-0.5 tabular-nums">¥{item.unit_price.toLocaleString()}</div>
                        </>
                      )}
                    </div>
                    <div>
                      {isLabor ? <span className="text-gray-300 text-sm">—</span> : (
                        <div className="relative">
                          <input type="number" step="1" value={Math.round(item.markup_rate * 100)}
                            onChange={e => updateItem(idx, 'markup_rate', Number(e.target.value) / 100)} min={0}
                            className="w-full pl-2 pr-5 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                        </div>
                      )}
                    </div>
                    <div>
                      {isLabor ? (
                        <>
                          <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <div className="text-right text-[11px] text-gray-400 mt-0.5 tabular-nums">¥{item.unit_price.toLocaleString()}</div>
                        </>
                      ) : (
                        <div className="text-right text-sm text-gray-700 tabular-nums py-1.5">¥{Math.round(item.unit_price * item.markup_rate).toLocaleString()}</div>
                      )}
                    </div>
                    <div className="text-right text-sm font-semibold text-gray-900 tabular-nums py-1.5">¥{item.amount.toLocaleString()}</div>
                    <div className="flex justify-center pt-1">
                      <button onClick={() => removeItem(idx)} title="この行を削除"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="md:hidden space-y-3">
          {items.map((item, idx) => {
            const isLabor = item.item_type === 'labor'
            return (
              <div key={idx} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <select value={item.item_type} onChange={e => updateItem(idx, 'item_type', e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="product">商品</option>
                    <option value="labor">作業</option>
                  </select>
                  <button onClick={() => removeItem(idx)} title="この行を削除"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" aria-label="この行を削除">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {!isLabor && (
                  <div className="mb-2">
                    <label className="block text-[11px] text-gray-500 mb-0.5">メーカー</label>
                    <label className="block text-[11px] text-gray-400 mb-0.5">型式検索</label>
                    <ProductModelSearch makers={MAKERS} onSelect={(r, m) => applyWin2kResult(idx, r, m)} />
                  </div>
                )}

                <div className="mb-2">
                  <label className="block text-[11px] text-gray-500 mb-0.5">品名</label>
                  {isLabor ? (
                    <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  ) : (
                    <div className="flex items-start gap-1">
                      <div className="flex-1 space-y-2">
                        <input value={splitName(item.name)[0]} onChange={e => updateItem(idx, 'name', joinName(e.target.value, splitName(item.name)[1]))}
                          placeholder="品名" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-0.5">型番</label>
                          <input value={splitName(item.name)[1]} onChange={e => updateItem(idx, 'name', joinName(splitName(item.name)[0], e.target.value))}
                            placeholder="型番" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                      {itemLinks[idx] && (
                        <a href={itemLinks[idx]!} target="_blank" rel="noreferrer noopener" title="公式サイトの商品ページを開く"
                          className="shrink-0 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12" />
                            <path d="M11 3h6v6" />
                            <path d="M9 11 17 3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">数量</label>
                    <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  {!isLabor && (
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">メーカー希望小売価格</label>
                      <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <div className="text-right text-[11px] text-gray-400 mt-0.5 tabular-nums">¥{item.unit_price.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {!isLabor && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">掛率</label>
                      <div className="relative">
                        <input type="number" step="1" value={Math.round(item.markup_rate * 100)}
                          onChange={e => updateItem(idx, 'markup_rate', Number(e.target.value) / 100)} min={0}
                          className="w-full pl-2 pr-5 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">仕切り価格</label>
                      <div className="px-2 py-1.5 text-sm text-right text-gray-700 tabular-nums">¥{Math.round(item.unit_price * item.markup_rate).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {isLabor && (
                  <div className="mb-2">
                    <label className="block text-[11px] text-gray-500 mb-0.5">仕切り価格</label>
                    <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <div className="text-right text-[11px] text-gray-400 mt-0.5 tabular-nums">¥{item.unit_price.toLocaleString()}</div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">金額</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">¥{item.amount.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 金額・保存操作 */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5">
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>小計</span><span className="tabular-nums">¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>消費税（10%）</span><span className="tabular-nums">¥{taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1.5 mt-1 border-t border-gray-200">
              <span>合計</span><span className="tabular-nums">¥{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-4">
          <Link href="/orders/quotations"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            キャンセル
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg shadow-sm">
            {saving ? '保存中...' : '変更を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
