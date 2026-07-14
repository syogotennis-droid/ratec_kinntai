'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, DocumentItem, Settings, Supplier } from '@/lib/supabase/types'
import Link from 'next/link'
import { downloadPurchaseOrderExcel } from '@/lib/excel/purchase-order'

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

interface FullPO {
  id: number
  project_id: number
  quotation_id: number | null
  supplier_id: number | null
  doc_no: string
  issue_date: string
  delivery_postal: string
  delivery_address: string
  notes: string | null
  subtotal: number
  tax_amount: number
  total_amount: number
  items: DocumentItem[]
  project: {
    id: number
    name: string
    company_id: number
    companies: { name: string } | null
  } | null
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [allProjects, setAllProjects] = useState<ProjectWithCompany[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  const [projectId, setProjectId] = useState<number>(0)
  const [projectName, setProjectName] = useState('')
  const [supplierId, setSupplierId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [deliveryPostal, setDeliveryPostal] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<DocumentItem, 'id'>[]>([])

  const [quotations, setQuotations] = useState<QuotationWithItems[]>([])
  const [quotationId, setQuotationId] = useState<number | null>(null)

  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [poRes, projectsRes, suppliersRes, settingsRes] = await Promise.all([
      supabase.from('purchase_orders')
        .select('*, items:purchase_order_items(*), project:projects(id,name,company_id,companies(name))')
        .eq('id', id).single(),
      supabase.from('projects').select('*, companies(*)').eq('status', 'active').order('name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('settings').select('*').single(),
    ])
    const data = poRes.data as FullPO | null
    const projects = (projectsRes.data ?? []).map((proj: any) => ({
      id: proj.id,
      name: proj.name,
      company_id: proj.company_id,
      companyData: proj.companies as Company,
    }))
    setAllProjects(projects)
    setSuppliers(suppliersRes.data ?? [])
    if (settingsRes.data) setSettings(settingsRes.data)
    if (data) {
      setProjectId(data.project_id)
      const proj = projects.find(p => p.id === data.project_id)
      setProjectName(proj?.name ?? data.project?.name ?? '')
      setSearchText(proj?.name ?? data.project?.name ?? '')
      setSupplierId(data.supplier_id ?? 0)
      setDocNo(data.doc_no)
      setIssueDate(data.issue_date)
      setDeliveryPostal(data.delivery_postal)
      setDeliveryAddress(data.delivery_address)
      setNotes(data.notes ?? '')
      setQuotationId(data.quotation_id)
      const sorted = [...(data.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(({ id: _id, ...rest }) => rest))
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

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
    if (!projectId) { setQuotations([]); return }
    createClient()
      .from('quotations')
      .select('*, items:quotation_items(*)')
      .eq('project_id', projectId)
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setQuotations((data ?? []) as QuotationWithItems[])
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

  const selectProject = (p: ProjectWithCompany) => {
    setProjectId(p.id)
    setProjectName(p.name)
    setSearchText(p.name)
    setDropdownOpen(false)
    setQuotationId(null)
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

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.from('purchase_orders').update({
        project_id: projectId,
        quotation_id: quotationId || null,
        supplier_id: supplierId || null,
        doc_no: docNo,
        issue_date: issueDate,
        delivery_postal: deliveryPostal,
        delivery_address: deliveryAddress,
        notes: notes || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      }).eq('id', id)
      if (updateErr) throw new Error(updateErr.message)
      const { error: deleteErr } = await supabase.from('purchase_order_items').delete().eq('purchase_order_id', Number(id))
      if (deleteErr) throw new Error(deleteErr.message)
      if (items.length > 0) {
        const { error: insertErr } = await supabase.from('purchase_order_items').insert(
          items.map((item, i) => ({
            purchase_order_id: Number(id),
            sort_order: i,
            name: item.name,
            spec: item.spec ?? '',
            qty: item.qty,
            unit: item.unit,
            unit_price: item.unit_price,
            amount: item.amount,
          }))
        )
        if (insertErr) throw new Error(insertErr.message)
      }
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
      await createClient().from('purchase_orders').delete().eq('id', id)
      router.push('/orders/purchase-orders')
    } catch {
      setError('削除に失敗しました')
      setSaving(false)
    }
  }

  const handleExcel = async () => {
    const supplierObj = suppliers.find(s => s.id === supplierId)
    await downloadPurchaseOrderExcel({
      docNo,
      issueDate,
      supplierName: supplierObj?.name ?? '',
      projectName,
      notes,
      items,
      settings,
    })
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">読み込み中...</div>

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/orders/purchase-orders" className="text-sm text-blue-600 hover:underline">← 一覧</Link>
        <h1 className="text-sm font-bold text-gray-900 flex-1">注文書</h1>
        <button onClick={handleExcel} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg">Excel出力</button>
        <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
      </div>
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">案件名</label>
          <div ref={searchRef} className="relative">
            <input
              type="text"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setDropdownOpen(true); if (!e.target.value) { setProjectId(0); setProjectName('') } }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="会社名・工事名で検索"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {dropdownOpen && Object.keys(grouped).length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {Object.values(grouped).map(({ company, projs }) => (
                  <div key={company?.id ?? 0}>
                    <div className="px-3 py-1 text-xs font-semibold text-gray-400 bg-gray-50 sticky top-0">{company?.name ?? '不明'}</div>
                    {projs.map(p => (
                      <button key={p.id} onMouseDown={() => selectProject(p)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${projectId === p.id ? 'text-blue-600 font-medium' : 'text-gray-800'}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {quotations.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">見積書から読み込み</label>
            <select value={quotationId ?? ''} onChange={e => {
              const qid = Number(e.target.value)
              setQuotationId(qid)
              const q = quotations.find(q => q.id === qid)
              if (q) importFromQuotation(q)
            }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">選択してください</option>
              {quotations.map(q => <option key={q.id} value={q.id}>{q.doc_no} ({q.issue_date})</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">仕入先</label>
          <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={0}>なし</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">注文書番号</label>
            <input type="text" value={docNo} onChange={e => setDocNo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">発注日</label>
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
          <button onClick={() => setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])}
            className="text-xs text-blue-600 hover:underline">+ 行追加</button>
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
                  <td className="py-1 px-1"><input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1"><input value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1"><input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0} className="w-14 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1"><input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-12 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1"><input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0} className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-2 text-right font-medium">¥{item.amount.toLocaleString()}</td>
                  <td className="py-1 px-1"><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 border-t border-gray-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">小計</span><span>¥{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">消費税（10%）</span><span>¥{taxAmount.toLocaleString()}</span></div>
          <div className="flex justify-between font-bold text-base"><span>合計</span><span>¥{totalAmount.toLocaleString()}</span></div>
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
