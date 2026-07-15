'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, Project, DocumentItem, Quotation } from '@/lib/supabase/types'
import Link from 'next/link'

const TAX_RATE = 0.1
const DEFAULT_DISCOUNT_DIGITS = 4

interface QuotationWithItems extends Quotation {
  items: DocumentItem[]
}

interface ProjectWithCompany extends Project {
  companyData: Company
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
          setItems(sorted.map(item => ({
            sort_order: item.sort_order, name: item.name, spec: item.spec ?? '',
            qty: item.qty, unit: item.unit, unit_price: item.unit_price, amount: item.amount,
          })))
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
    setItems(sorted.map(item => ({
      sort_order: item.sort_order, name: item.name, spec: item.spec ?? '',
      qty: item.qty, unit: item.unit, unit_price: item.unit_price, amount: item.amount,
    })))
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
    if (!projectId) { setError('工事名を選択してください'); return }
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
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/orders/invoices" className="text-sm text-blue-600 hover:underline">← 一覧</Link>
        <h1 className="text-sm font-bold text-gray-900">新規請求書/納品書</h1>
      </div>

      <div className="space-y-3 mb-6">
        {/* Project search */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">工事名 *</label>
          <div className="relative" ref={searchRef}>
            {selectedProject ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <span className="text-xs text-gray-500">{selectedProject.companyData.name}</span>
                <span className="text-sm text-gray-900 flex-1">{selectedProject.name}</span>
                <button onClick={() => { setSelectedProject(null); setProjectId(0); setQuotations([]) }}
                  className="text-gray-400 hover:text-gray-600 text-xs">×</button>
              </div>
            ) : (
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowResults(true); setHighlightIndex(-1) }}
                onFocus={() => setShowResults(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="会社名・工事名で検索"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">引き継ぐ見積書</label>
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
          <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            見積書 {quotations[0].doc_no || quotations[0].issue_date} から明細を引き継ぎました
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">請求書番号（自動）</label>
            <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-gray-50">{docNo || '...'}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">発行日</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-gray-700">明細</h2>
          <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ 行追加</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200">
                {['品名', '仕様', '数量', '単位', '単価', '金額', ''].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 px-1">
                    <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0}
                      className="w-14 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                      className="w-12 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0}
                      className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-1 px-2 text-right font-medium">¥{item.amount.toLocaleString()}</td>
                  <td className="py-1 px-1">
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-t border-gray-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">明細小計</span>
            <span>¥{itemsSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 flex items-center gap-1">
              特別調整値引き（<input
                type="number" value={discountDigits} min={1} max={8}
                onChange={e => setDiscountDigits(Math.max(1, Math.min(8, Number(e.target.value))))}
                className="w-10 px-1 py-0.5 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />桁）
            </span>
            <span className="text-red-600">¥{discountAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">課税対象計</span>
            <span>¥{adjustedSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">消費税（10%）</span>
            <span>¥{taxAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>合計</span>
            <span>¥{totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
        {saving ? '保存中...' : '作成'}
      </button>
    </div>
  )
}
