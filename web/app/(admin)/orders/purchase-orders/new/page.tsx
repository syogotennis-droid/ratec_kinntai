'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, DocumentItem, Settings, Supplier } from '@/lib/supabase/types'
import Link from 'next/link'

const TAX_RATE = 0.1

interface ProjectWithCompany {
  id: number
  name: string
  company_id: number
  companyData: Company
}

interface QuotationWithItems {
  id: number
  doc_no: string
  issue_date: string
  items?: DocumentItem[]
}

async function generateDocNo() {
  const today = new Date().toLocaleDateString('sv-SE')
  const mmdd = today.slice(5, 7) + today.slice(8, 10)
  const { data } = await createClient().from('purchase_orders').select('doc_no').like('doc_no', `${mmdd}-%`)
  const maxN = (data ?? []).reduce((max, po) => {
    const n = parseInt(po.doc_no.split('-')[1] ?? '0')
    return Math.max(max, isNaN(n) ? 0 : n)
  }, 0)
  return `${mmdd}-${maxN + 1}`
}

const ITEM_GRID_COLS = '[grid-template-columns:2fr_1.1fr_60px_56px_112px_128px_40px]'

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.6 12.2A2 2 0 0114.4 21H9.6a2 2 0 01-2-1.8L7 7h10z" />
    </svg>
  )
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const [allProjects, setAllProjects] = useState<ProjectWithCompany[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  const [projectId, setProjectId] = useState<number>(0)
  const [projectName, setProjectName] = useState('')
  const [supplierId, setSupplierId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [deliveryPostal, setDeliveryPostal] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<DocumentItem, 'id'>[]>([
    { sort_order: 0, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }
  ])

  const [quotations, setQuotations] = useState<QuotationWithItems[]>([])
  const [quotationId, setQuotationId] = useState<number | null>(null)

  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const searchRef = useRef<HTMLDivElement>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('projects').select('*, companies(*)').order('name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('settings').select('*').single(),
    ]).then(([p, s, st]) => {
      const projects = (p.data ?? []).map((proj: any) => ({
        id: proj.id,
        name: proj.name,
        company_id: proj.company_id,
        companyData: proj.companies as Company,
      }))
      setAllProjects(projects)
      setSuppliers(s.data ?? [])
      if (st.data) {
        setSettings(st.data)
        setDeliveryPostal(st.data.company_postal)
        setDeliveryAddress(st.data.company_address)
      }
    })
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!projectId) { setQuotations([]); setQuotationId(null); return }
    createClient()
      .from('quotations')
      .select('*, items:quotation_items(*)')
      .eq('project_id', projectId)
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        const qs = (data ?? []) as QuotationWithItems[]
        setQuotations(qs)
        if (qs.length > 0) {
          const latest = qs[0]
          setQuotationId(latest.id)
          importFromQuotation(latest)
        } else {
          setQuotationId(null)
          setItems([{ sort_order: 0, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])
        }
      })
  }, [projectId])

  const importFromQuotation = (q: QuotationWithItems) => {
    const sorted = [...(q.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    setItems(sorted.map(item => ({
      sort_order: item.sort_order,
      name: item.name,
      spec: item.spec ?? '',
      qty: item.qty,
      unit: item.unit,
      unit_price: 0,
      amount: 0,
    })))
  }

  const filtered = searchText
    ? allProjects.filter(p =>
        p.name.includes(searchText) || p.companyData?.name.includes(searchText)
      )
    : allProjects

  const grouped = filtered.reduce<Record<number, { company: Company; projs: ProjectWithCompany[] }>>((acc, p) => {
    if (!acc[p.company_id]) acc[p.company_id] = { company: p.companyData, projs: [] }
    acc[p.company_id].projs.push(p)
    return acc
  }, {})

  const flatResults = Object.values(grouped).flatMap(g => g.projs)

  const selectProject = (p: ProjectWithCompany) => {
    setProjectId(p.id)
    setProjectName(p.name)
    setSearchText(p.name)
    setDropdownOpen(false)
    setHighlightIndex(-1)
    setError(null)
  }

  useEffect(() => {
    if (highlightIndex < 0) return
    itemRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || flatResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => (i <= 0 ? flatResults.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0) {
        e.preventDefault()
        selectProject(flatResults[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
    }
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const taxAmount = Math.floor(subtotal * TAX_RATE)
  const totalAmount = subtotal + taxAmount

  const updateItem = (idx: number, field: keyof Omit<DocumentItem, 'id'>, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [field]: value }
      if (field === 'qty' || field === 'unit_price') item.amount = Number(item.qty) * Number(item.unit_price)
      next[idx] = item
      return next
    })
  }

  const addItem = () => setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const projectError = error === '案件名を選択してください' ? error : null

  const handleSave = async () => {
    if (!projectId) { setError('案件名を選択してください'); return }
    setError(null)
    setSaving(true)
    try {
      const generatedDocNo = await generateDocNo()
      const supabase = createClient()
      const { data: po, error: poErr } = await supabase.from('purchase_orders').insert({
        project_id: projectId,
        quotation_id: quotationId || null,
        supplier_id: supplierId || null,
        doc_no: generatedDocNo,
        issue_date: issueDate,
        delivery_postal: deliveryPostal,
        delivery_address: deliveryAddress,
        notes: notes || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      }).select().single()
      if (poErr) throw new Error(poErr.message)
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from('purchase_order_items').insert(
          items.map((item, i) => ({
            purchase_order_id: po.id,
            sort_order: i,
            name: item.name,
            spec: item.spec ?? '',
            qty: item.qty,
            unit: item.unit,
            unit_price: item.unit_price,
            amount: item.amount,
          }))
        )
        if (itemsErr) throw new Error(itemsErr.message)
      }
      router.push(`/orders/purchase-orders/${po.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-[1180px] mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <Link href="/orders/purchase-orders" className="text-sm text-blue-600 hover:underline shrink-0">← 一覧へ戻る</Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">新規注文書</h1>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">仕入先への注文書を作成します</p>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">基本情報</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">案件名 *</label>
            <div ref={searchRef} className="relative">
              <input
                type="text"
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setDropdownOpen(true); setHighlightIndex(-1); if (!e.target.value) { setProjectId(0); setProjectName('') } }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="会社名・案件名で検索"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${projectError ? 'border-red-400' : 'border-gray-300'}`}
              />
              {dropdownOpen && Object.keys(grouped).length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {Object.values(grouped).map(({ company, projs }) => (
                    <div key={company?.id ?? 0}>
                      <div className="px-3 py-1 text-xs font-semibold text-gray-400 bg-gray-50 sticky top-0">{company?.name ?? '不明'}</div>
                      {projs.map(p => {
                        const flatIndex = flatResults.indexOf(p)
                        return (
                          <button key={p.id}
                            ref={el => { itemRefs.current[flatIndex] = el }}
                            onMouseDown={() => selectProject(p)}
                            onMouseEnter={() => setHighlightIndex(flatIndex)}
                            className={`w-full text-left px-4 py-2 text-sm ${
                              flatIndex === highlightIndex ? 'bg-blue-50 text-blue-600 font-medium' : projectId === p.id ? 'text-blue-600 font-medium' : 'text-gray-800 hover:bg-blue-50'
                            }`}>
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {projectError && <p className="mt-1 text-xs text-red-600">{projectError}</p>}
          </div>

          {quotations.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">見積書</label>
              <select value={quotationId ?? ''} onChange={e => {
                const id = Number(e.target.value)
                setQuotationId(id)
                const q = quotations.find(q => q.id === id)
                if (q) importFromQuotation(q)
              }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {quotations.map(q => <option key={q.id} value={q.id}>{q.doc_no} ({q.issue_date})</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
              <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={0}>未選択</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">発注日</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </div>

      {/* 明細・金額集計・作成操作（1つのカードにまとめる） */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">明細</h2>
          <button onClick={addItem}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            + 行追加
          </button>
        </div>

        {/* PC: 一覧表示 */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[900px]">
            <div className={`grid ${ITEM_GRID_COLS} gap-2 border-b border-gray-200 pb-2 text-xs font-medium text-gray-500`}>
              <div>品名</div>
              <div>仕様・型番</div>
              <div>数量</div>
              <div>単位</div>
              <div className="text-right">単価</div>
              <div className="text-right">金額</div>
              <div />
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <div key={idx} className={`grid ${ITEM_GRID_COLS} gap-2 items-center py-2`}>
                  <div>
                    <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <input value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <p className="text-[11px] text-gray-400 text-right mt-0.5 tabular-nums">¥{item.unit_price.toLocaleString()}</p>
                  </div>
                  <div className="text-right text-sm font-semibold text-gray-900 tabular-nums py-1.5">¥{item.amount.toLocaleString()}</div>
                  <div className="flex justify-center pt-1.5">
                    <button onClick={() => removeItem(idx)} title="この行を削除"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="md:hidden space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">明細 {idx + 1}</span>
                <button onClick={() => removeItem(idx)} title="この行を削除"
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" aria-label="この行を削除">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="mb-2">
                <label className="block text-[11px] text-gray-500 mb-0.5">品名</label>
                <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="mb-2">
                <label className="block text-[11px] text-gray-500 mb-0.5">仕様・型番</label>
                <input value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">数量</label>
                  <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">単位</label>
                  <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">単価</label>
                  <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <p className="text-[11px] text-gray-400 text-right mt-0.5 tabular-nums">¥{item.unit_price.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">金額</label>
                  <div className="px-2 py-1.5 text-sm font-semibold text-right text-gray-900 tabular-nums">¥{item.amount.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 金額集計・作成操作（明細の続きとして同一カード内に配置） */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-full sm:max-w-[460px] space-y-1">
              <div className="flex justify-between items-baseline text-sm text-gray-500">
                <span>小計</span><span className="tabular-nums">¥{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline text-sm text-gray-500">
                <span>消費税（10%）</span><span className="tabular-nums">¥{taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline text-lg font-bold text-gray-900 pt-1.5 mt-1 border-t border-gray-200">
                <span>合計</span><span className="tabular-nums">¥{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && !projectError && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-2 mt-3">
            <Link href="/orders/purchase-orders"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
              キャンセル
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg shadow-sm">
              {saving ? '作成中...' : '注文書を作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
