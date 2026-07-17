'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, Project, DocumentItem, Quotation, QuotationItem } from '@/lib/supabase/types'
import Link from 'next/link'

const TAX_RATE = 0.1
const DEFAULT_DISCOUNT_DIGITS = 4

interface QuotationWithItems extends Quotation {
  items: QuotationItem[]
}

// 見積書の単価は希望小売価格。請求書には実際の請求単価である仕切り価格（希望小売価格×仕切掛け率）を引き継ぐ
function shikiriUnitPrice(item: QuotationItem): number {
  return item.item_type === 'labor' ? item.unit_price : Math.round(item.unit_price * item.markup_rate)
}

// 単価を仕切り価格に置き換えるため、金額も数量×仕切り価格で引き継ぎ時に再計算する（見積書側のamountは希望小売価格ベースのため使用しない）
function toInvoiceItem(item: QuotationItem): Omit<DocumentItem, 'id'> {
  const unitPrice = shikiriUnitPrice(item)
  return {
    sort_order: item.sort_order, name: item.name, spec: item.spec ?? '',
    qty: item.qty, unit: item.unit, unit_price: unitPrice, amount: item.qty * unitPrice,
  }
}

interface ProjectWithCompany extends Project {
  companyData: Company
}

const ITEM_GRID_COLS = '[grid-template-columns:2fr_1.1fr_60px_56px_112px_128px_40px]'

// 品名はExcel上は1セル(改行区切り2行)だが、システム上は品名・型番を分けて入力できるようにする
function splitName(name: string): [string, string] {
  const idx = name.indexOf('\n')
  return idx === -1 ? [name, ''] : [name.slice(0, idx), name.slice(idx + 1)]
}
function joinName(line1: string, line2: string): string {
  return line2 ? `${line1}\n${line2}` : line1
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.6 12.2A2 2 0 0114.4 21H9.6a2 2 0 01-2-1.8L7 7h10z" />
    </svg>
  )
}

export default function NewInvoicePage() {
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)

  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [quotations, setQuotations] = useState<QuotationWithItems[]>([])

  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithCompany | null>(null)
  const [projectId, setProjectId] = useState<number>(0)
  const [quotationId, setQuotationId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [notes, setNotes] = useState('')
  const [discountDigits, setDiscountDigits] = useState(DEFAULT_DISCOUNT_DIGITS)
  const [items, setItems] = useState<Omit<DocumentItem, 'id'>[]>([
    { sort_order: 0, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('companies').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('*').order('name'),
    ]).then(([c, p]) => {
      setCompanies(c.data ?? [])
      setProjects(p.data ?? [])
    })
    // Generate today's doc_no
    generateDocNo().then(setDocNo)
  }, [])

  const generateDocNo = async () => {
    const today = new Date().toLocaleDateString('sv-SE')
    const mmdd = today.slice(5, 7) + today.slice(8, 10)
    const { data } = await createClient()
      .from('invoices')
      .select('doc_no')
      .like('doc_no', `${mmdd}-%`)
    const maxN = (data ?? []).reduce((max, inv) => {
      const n = parseInt(inv.doc_no.split('-')[1] ?? '0')
      return Math.max(max, isNaN(n) ? 0 : n)
    }, 0)
    return `${mmdd}-${maxN + 1}`
  }

  // Load quotations and auto-import latest when project changes
  useEffect(() => {
    if (!projectId) { setQuotations([]); return }
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
          const sorted = [...(latest.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
          setItems(sorted.map(toInvoiceItem))
        } else {
          setQuotationId(0)
          setItems([{ sort_order: 0, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])
        }
      })
  }, [projectId])

  // Click outside to close results
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const projectsWithCompany: ProjectWithCompany[] = projects
    .map(p => ({ ...p, companyData: companies.find(c => c.id === p.company_id)! }))
    .filter(p => p.companyData)

  const filtered = search
    ? projectsWithCompany.filter(p =>
        p.name.includes(search) || p.companyData.name.includes(search)
      )
    : projectsWithCompany

  // Group by company
  const grouped = filtered.reduce<Record<number, { company: Company; projs: ProjectWithCompany[] }>>((acc, p) => {
    if (!acc[p.company_id]) acc[p.company_id] = { company: p.companyData, projs: [] }
    acc[p.company_id].projs.push(p)
    return acc
  }, {})

  const flatResults = Object.values(grouped).flatMap(g => g.projs)

  const selectProject = (p: ProjectWithCompany) => {
    setSelectedProject(p)
    setProjectId(p.id)
    setSearch('')
    setShowResults(false)
    setHighlightIndex(-1)
    setQuotationId(0)
    setItems([{ sort_order: 0, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])
  }

  useEffect(() => {
    if (highlightIndex < 0) return
    itemRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || flatResults.length === 0) return
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
      setShowResults(false)
    }
  }

  const importFromQuotation = (qId: number) => {
    setQuotationId(qId)
    const q = quotations.find(q => q.id === qId)
    if (!q) return
    const sorted = [...(q.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    setItems(sorted.map(toInvoiceItem))
  }

  const itemsSubtotal = items.reduce((s, i) => s + i.amount, 0)
  const divisor = Math.pow(10, discountDigits)
  const discountAmount = itemsSubtotal > 0 ? -(itemsSubtotal % divisor) : 0
  const adjustedSubtotal = itemsSubtotal + discountAmount
  const taxAmount = Math.floor(adjustedSubtotal * TAX_RATE)
  const totalAmount = adjustedSubtotal + taxAmount

  const updateItem = (idx: number, field: keyof Omit<DocumentItem, 'id'>, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [field]: value }
      if (field === 'qty' || field === 'unit_price') {
        item.amount = Number(item.qty) * Number(item.unit_price)
      }
      next[idx] = item
      return next
    })
  }

  const addItem = () => setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!projectId) { setError('案件名を選択してください'); return }
    setError(null)
    setSaving(true)
    try {
      // Re-generate doc_no at save time to ensure uniqueness
      const finalDocNo = await generateDocNo()
      const supabase = createClient()
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        project_id: projectId,
        quotation_id: quotationId || null,
        doc_no: finalDocNo,
        issue_date: issueDate,
        status: '下書き',
        notes: notes || null,
        subtotal: adjustedSubtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        discount_digits: discountDigits,
      }).select().single()
      if (invErr) throw invErr
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from('invoice_items').insert(
          items.map((item, i) => ({
            invoice_id: inv.id, sort_order: i,
            name: item.name, spec: item.spec ?? '', qty: item.qty,
            unit: item.unit, unit_price: item.unit_price, amount: item.amount,
          }))
        )
        if (itemsErr) throw new Error(itemsErr.message)
      }
      router.push(`/orders/invoices/${inv.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-[1180px] mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <Link href="/orders/invoices" className="text-sm text-blue-600 hover:underline shrink-0">← 一覧へ戻る</Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">新規請求書・納品書</h1>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">請求書と納品書を作成します</p>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">基本情報</h2>
        <div className="space-y-3">
          {/* Project search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">案件名 *</label>
            <div className="relative" ref={searchRef}>
              {selectedProject ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <span className="text-xs text-gray-500 shrink-0 max-w-[40%] truncate" title={selectedProject.companyData.name}>{selectedProject.companyData.name}</span>
                  <span className="text-sm text-gray-900 flex-1 min-w-0 truncate" title={selectedProject.name}>{selectedProject.name}</span>
                  <button onClick={() => { setSelectedProject(null); setProjectId(0); setQuotations([]) }}
                    className="text-gray-400 hover:text-gray-600 text-xs shrink-0">×</button>
                </div>
              ) : (
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowResults(true); setHighlightIndex(-1) }}
                  onFocus={() => setShowResults(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="会社名・案件名で検索"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {showResults && !selectedProject && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                  {Object.values(grouped).length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">該当なし</div>
                  ) : (
                    Object.values(grouped).map(({ company, projs }) => (
                      <div key={company.id}>
                        <div className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-50 sticky top-0">
                          {company.name}
                        </div>
                        {projs.map(p => {
                          const flatIndex = flatResults.indexOf(p)
                          return (
                            <button
                              key={p.id}
                              ref={el => { itemRefs.current[flatIndex] = el }}
                              onMouseDown={() => selectProject(p)}
                              onMouseEnter={() => setHighlightIndex(flatIndex)}
                              className={`w-full text-left px-5 py-2 text-sm transition-colors ${
                                flatIndex === highlightIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-800 hover:bg-blue-50'
                              }`}
                            >
                              {p.name}
                            </button>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quotation selector (if multiple) */}
          {quotations.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">引き継ぐ見積書</label>
              <select value={quotationId} onChange={e => importFromQuotation(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {quotations.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.doc_no || '番号なし'} {q.issue_date} ¥{q.total_amount.toLocaleString()} [{q.status}]
                  </option>
                ))}
              </select>
            </div>
          )}
          {quotations.length === 1 && (
            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
              見積書 {quotations[0].doc_no || quotations[0].issue_date} から明細を引き継ぎました
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">請求書番号（自動）</label>
              <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50">{docNo || '...'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">発行日</label>
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
              <div>品名・型番</div>
              <div>仕様</div>
              <div>数量</div>
              <div>単位</div>
              <div className="text-right">単価</div>
              <div className="text-right">金額</div>
              <div />
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <div key={idx} className={`grid ${ITEM_GRID_COLS} gap-2 items-start py-2`}>
                  <div className="flex flex-col gap-1">
                    <input value={splitName(item.name)[0]} onChange={e => updateItem(idx, 'name', joinName(e.target.value, splitName(item.name)[1]))}
                      placeholder="品名" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input value={splitName(item.name)[1]} onChange={e => updateItem(idx, 'name', joinName(splitName(item.name)[0], e.target.value))}
                      placeholder="型番" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
                <input value={splitName(item.name)[0]} onChange={e => updateItem(idx, 'name', joinName(e.target.value, splitName(item.name)[1]))}
                  placeholder="品名" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="mb-2">
                <label className="block text-[11px] text-gray-500 mb-0.5">型番</label>
                <input value={splitName(item.name)[1]} onChange={e => updateItem(idx, 'name', joinName(splitName(item.name)[0], e.target.value))}
                  placeholder="型番" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="mb-2">
                <label className="block text-[11px] text-gray-500 mb-0.5">仕様</label>
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
                <span>明細小計</span><span className="tabular-nums">¥{itemsSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline text-sm text-gray-500 gap-2">
                <span className="flex items-center gap-1 shrink-0">
                  端数調整（<input
                    type="number" value={discountDigits} min={1} max={8}
                    onChange={e => setDiscountDigits(Math.max(1, Math.min(8, Number(e.target.value))))}
                    className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />桁）
                </span>
                <span className="text-rose-500 tabular-nums">値引き額：¥{discountAmount.toLocaleString()}</span>
              </div>
              <p className="text-[11px] text-gray-400">明細小計を指定した桁数で切り捨て、端数分を値引きとして計算します</p>
              <div className="flex justify-between items-baseline text-sm text-gray-500">
                <span>課税対象計</span><span className="tabular-nums">¥{adjustedSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline text-sm text-gray-500">
                <span>消費税（10%）</span><span className="tabular-nums">¥{taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline text-lg font-bold text-gray-900 pt-1.5 mt-1 border-t border-gray-200">
                <span>合計</span><span className="tabular-nums">¥{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-2 mt-3">
            <Link href="/orders/invoices"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
              キャンセル
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg shadow-sm">
              {saving ? '作成中...' : '請求書・納品書を作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
