'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Quotation, DocumentItem, Project, Supplier, QuotationStatus, Settings, CompanyContact } from '@/lib/supabase/types'
import Link from 'next/link'
import { downloadQuotationExcel } from '@/lib/excel/quotation'
import ProductModelSearch, { Maker } from '@/components/ProductModelSearch'
import { Win2kResult } from '@/lib/win2k'

const MAKERS: Maker[] = [
  { key: 'mitsubishi', label: '三菱', endpoint: '/api/win2k-search', accent: 'red' },
  { key: 'toshiba', label: '東芝', endpoint: '/api/toshiba-search', accent: 'blue' },
]
import { useProfile } from '@/lib/profile-context'

const TAX_RATE = 0.1
const STATUSES: QuotationStatus[] = ['作成中', '確定', '失注']

interface FullQuotation extends Quotation {
  items: DocumentItem[]
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const profile = useProfile()
  const [quotation, setQuotation] = useState<FullQuotation | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [projectId, setProjectId] = useState<number>(0)
  const [supplierId, setSupplierId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [status, setStatus] = useState<QuotationStatus>('作成中')
  const [contactPerson, setContactPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<DocumentItem, 'id'>[]>([])
  const [itemLinks, setItemLinks] = useState<(string | null)[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [qRes, projectsRes, suppliersRes, settingsRes] = await Promise.all([
      supabase.from('quotations').select('*, items:quotation_items(*)').eq('id', id).single(),
      supabase.from('projects').select('*, companies(name)').order('name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('settings').select('*').single(),
    ])
    const q = qRes.data as FullQuotation | null
    setQuotation(q)
    setProjects(projectsRes.data ?? [])
    setSuppliers(suppliersRes.data ?? [])
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
    if (!projectId) return
    const proj = projects.find(p => p.id === projectId) as { company_id?: number } | undefined
    const companyId = proj?.company_id
    if (!companyId) return
    createClient().from('company_contacts').select('*').eq('company_id', companyId).order('created_at').then(({ data }) => {
      setContacts(data ?? [])
    })
  }, [projectId, projects])

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

  const applyWin2kResult = (idx: number, result: Win2kResult) => {
    setItems(prev => {
      const next = [...prev]
      const unitPrice = result.price ?? next[idx].unit_price
      next[idx] = { ...next[idx], name: result.code, unit_price: unitPrice, amount: next[idx].qty * unitPrice }
      return next
    })
    setItemLinks(prev => {
      const next = [...prev]
      next[idx] = result.detailUrl
      return next
    })
  }

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

  if (loading) return <div className="p-6 text-sm text-gray-500">読み込み中...</div>
  if (!quotation) return <div className="p-6 text-sm text-gray-500">見つかりません</div>

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/orders/quotations" className="text-sm text-blue-600 hover:underline">← 一覧</Link>
        <h1 className="text-sm font-bold text-gray-900 flex-1">見積書</h1>
        <button onClick={handleExport} disabled={exporting || saving}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg">
          {exporting ? '出力中...' : 'Excel出力'}
        </button>
        <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
      </div>
      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">案件名</label>
            <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
            <select value={status} onChange={e => setStatus(e.target.value as QuotationStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">見積書番号（任意）</label>
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
          <label className="block text-xs font-medium text-gray-700 mb-1">仕入先（任意）</label>
          <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={0}>なし</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">担当者（任意）</label>
          {contacts.length > 0 ? (
            <select value={contactPerson} onChange={e => setContactPerson(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">なし</option>
              {contacts.map(c => (
                <option key={c.id} value={c.name}>{c.name}{c.position ? `（${c.position}）` : ''}</option>
              ))}
            </select>
          ) : (
            <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)}
              placeholder="例：山田 太郎"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
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
          <button onClick={() => { setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }]); setItemLinks(prev => [...prev, null]) }} className="text-xs text-blue-600 hover:underline">+ 行追加</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200">
                {['型式検索', '品名', '数量', '単位', '単価', '金額', ''].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 px-1"><ProductModelSearch makers={MAKERS} onSelect={r => applyWin2kResult(idx, r)} /></td>
                  <td className="py-1 px-1">
                    <div className="flex items-center gap-1">
                      <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      {itemLinks[idx] && (
                        <a href={itemLinks[idx]!} target="_blank" rel="noreferrer noopener" title="公式サイトの商品ページを開く"
                          className="shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12" />
                            <path d="M11 3h6v6" />
                            <path d="M9 11 17 3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-1 px-1"><input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0} className="w-14 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1"><input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-12 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1"><input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0} className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-2 text-right font-medium">¥{item.amount.toLocaleString()}</td>
                  <td className="py-1 px-1"><button onClick={() => { setItems(prev => prev.filter((_, i) => i !== idx)); setItemLinks(prev => prev.filter((_, i) => i !== idx)) }} className="text-red-400 hover:text-red-600">×</button></td>
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
