'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Invoice, DocumentItem, Company, Project, InvoiceStatus, Quotation, Settings } from '@/lib/supabase/types'
import Link from 'next/link'
import { downloadInvoiceExcel } from '@/lib/excel/invoice'

const TAX_RATE = 0.1
const STATUSES: InvoiceStatus[] = ['下書き', '発行済', '送付済', '入金済']

interface FullInvoice extends Invoice {
  items: DocumentItem[]
  project?: { id: number; name: string; company_id: number; companies?: { name: string; postal: string; address: string } | null } | null
}

interface QuotationWithItems extends Quotation {
  items: DocumentItem[]
}

interface ProjectWithCompany extends Project {
  companyData: Company
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)

  const [invoice, setInvoice] = useState<FullInvoice | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [quotations, setQuotations] = useState<QuotationWithItems[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectWithCompany | null>(null)
  const [projectId, setProjectId] = useState<number>(0)
  const [quotationId, setQuotationId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [status, setStatus] = useState<InvoiceStatus>('下書き')
  const [notes, setNotes] = useState('')
  const [discountDigits, setDiscountDigits] = useState(4)
  const [items, setItems] = useState<Omit<DocumentItem, 'id'>[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [invRes, companiesRes, projectsRes, settingsRes] = await Promise.all([
      supabase.from('invoices').select('*, items:invoice_items(*), project:projects(id,name,company_id,companies(name,postal,address))').eq('id', id).single(),
      supabase.from('companies').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('settings').select('*').single(),
    ])
    const inv = invRes.data as FullInvoice | null
    const comps = companiesRes.data ?? []
    const projs = projectsRes.data ?? []
    setInvoice(inv)
    setCompanies(comps)
    setProjects(projs)
    setSettings(settingsRes.data ?? null)
    if (inv) {
      setProjectId(inv.project_id)
      setQuotationId(inv.quotation_id ?? 0)
      setDocNo(inv.doc_no)
      setIssueDate(inv.issue_date)
      setStatus(inv.status)
      setNotes(inv.notes ?? '')
      setDiscountDigits(inv.discount_digits ?? 4)
      const sortedItems = [...(inv.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sortedItems.map(({ id: _id, ...rest }) => rest))
      // Set selected project display
      const proj = projs.find(p => p.id === inv.project_id)
      if (proj) {
        const comp = comps.find(c => c.id === proj.company_id)
        if (comp) setSelectedProject({ ...proj, companyData: comp })
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // Load quotations when project changes
  useEffect(() => {
    if (!projectId) { setQuotations([]); return }
    createClient()
      .from('quotations')
      .select('*, items:quotation_items(*)')
      .eq('project_id', projectId)
      .order('issue_date', { ascending: false })
      .then(({ data }) => setQuotations((data ?? []) as QuotationWithItems[]))
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

  const grouped = filtered.reduce<Record<number, { company: Company; projs: ProjectWithCompany[] }>>((acc, p) => {
    if (!acc[p.company_id]) acc[p.company_id] = { company: p.companyData, projs: [] }
    acc[p.company_id].projs.push(p)
    return acc
  }, {})

  const selectProject = (p: ProjectWithCompany) => {
    setSelectedProject(p)
    setProjectId(p.id)
    setSearch('')
    setShowResults(false)
    setQuotationId(0)
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

  const itemsSubtotal = items.reduce((s, item) => s + item.amount, 0)
  const divisor = Math.pow(10, discountDigits)
  const discountAmount = itemsSubtotal > 0 ? -(itemsSubtotal % divisor) : 0
  const adjustedSubtotal = itemsSubtotal + discountAmount
  const taxAmount = Math.floor(adjustedSubtotal * TAX_RATE)
  const totalAmount = adjustedSubtotal + taxAmount

  const handleExport = async () => {
    setError(null)
    setExporting(true)
    try {
      const proj = invoice?.project
      const company = companies.find(c => c.id === (selectedProject?.company_id ?? proj?.company_id)) ?? null
      const companyInfo = proj?.companies as { name?: string; postal?: string; address?: string } | null | undefined
      await downloadInvoiceExcel({
        docNo,
        issueDate,
        customerName: companyInfo?.name ?? company?.name ?? '',
        customerPostal: companyInfo?.postal ?? company?.postal ?? '',
        customerAddress: companyInfo?.address ?? company?.address ?? '',
        notes,
        items,
        discountDigits,
        discountAmount,
        adjustedSubtotal,
        taxAmount,
        totalAmount,
        settings,
        company,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Excel出力に失敗しました')
    } finally {
      setExporting(false)
    }
  }

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
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.from('invoices').update({
        project_id: projectId,
        quotation_id: quotationId || null,
        doc_no: docNo,
        issue_date: issueDate,
        status,
        notes: notes || null,
        subtotal: adjustedSubtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        discount_digits: discountDigits,
      }).eq('id', id)
      if (updateErr) throw new Error(updateErr.message)
      const { error: deleteErr } = await supabase.from('invoice_items').delete().eq('invoice_id', Number(id))
      if (deleteErr) throw new Error(deleteErr.message)
      if (items.length > 0) {
        const { error: insertErr } = await supabase.from('invoice_items').insert(
          items.map((item, i) => ({
            invoice_id: Number(id), sort_order: i,
            name: item.name, spec: item.spec ?? '', qty: item.qty,
            unit: item.unit, unit_price: item.unit_price, amount: item.amount,
          }))
        )
        if (insertErr) throw new Error(insertErr.message)
      }
      router.push('/orders/invoices')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('削除しますか？')) return
    setSaving(true)
    try {
      await createClient().from('invoices').delete().eq('id', id)
      router.push('/orders/invoices')
    } catch {
      setError('削除に失敗しました')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">読み込み中...</div>
  if (!invoice) return <div className="p-6 text-sm text-gray-500">見つかりません</div>

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/orders/invoices" className="text-sm text-blue-600 hover:underline">← 一覧</Link>
        <h1 className="text-sm font-bold text-gray-900 flex-1">請求書/納品書</h1>
        <button onClick={handleExport} disabled={exporting || saving}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg">
          {exporting ? '出力中...' : 'Excel出力'}
        </button>
        <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
      </div>

      <div className="space-y-3 mb-6">
        {/* Project search */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">工事名</label>
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
                  onChange={e => { setSearch(e.target.value); setShowResults(true) }}
                  onFocus={() => setShowResults(true)}
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
                        {projs.map(p => (
                          <button
                            key={p.id}
                            onMouseDown={() => selectProject(p)}
                            className="w-full text-left px-5 py-2 text-sm text-gray-800 hover:bg-blue-50 transition-colors"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
            <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Quotation selector */}
        {quotations.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">引き継ぐ見積書</label>
            <select value={quotationId} onChange={e => importFromQuotation(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>選択してください</option>
              {quotations.map(q => (
                <option key={q.id} value={q.id}>
                  {q.doc_no || '番号なし'} {q.issue_date} ¥{q.total_amount.toLocaleString()} [{q.status}]
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">請求書番号</label>
            <input type="text" value={docNo} onChange={e => setDocNo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  )
}
