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

  const selectProject = (p: ProjectWithCompany) => {
    setProjectId(p.id)
    setProjectName(p.name)
    setSearchText(p.name)
    setDropdownOpen(false)
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
    if (!projectId) { setError('工事名を選択してください'); return }
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
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/orders/purchase-orders" className="text-sm text-blue-600 hover:underline">← 一覧</Link>
        <h1 className="text-sm font-bold text-gray-900">新規注文書</h1>
      </div>
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">案件名 *</label>
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
        {quotations.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">見積書</label>
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
        {saving ? '保存中...' : '作成'}
      </button>
    </div>
  )
}
