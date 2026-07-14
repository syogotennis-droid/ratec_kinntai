'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, Project, DocumentItem } from '@/lib/supabase/types'
import Link from 'next/link'

const TAX_RATE = 0.1

export default function NewInvoicePage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [companyId, setCompanyId] = useState<number>(0)
  const [projectId, setProjectId] = useState<number>(0)
  const [docNo, setDocNo] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [notes, setNotes] = useState('')
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
  }, [])

  const filteredProjects = companyId ? projects.filter(p => p.company_id === companyId) : projects

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const taxAmount = Math.floor(subtotal * TAX_RATE)
  const totalAmount = subtotal + taxAmount

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
    if (!projectId || !docNo) { setError('工事名と請求書番号を入力してください'); return }
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        project_id: projectId,
        doc_no: docNo,
        issue_date: issueDate,
        status: '下書き',
        notes: notes || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      }).select().single()
      if (invErr) throw invErr
      if (items.length > 0) {
        await supabase.from('invoice_items').insert(
          items.map((item, i) => ({ ...item, invoice_id: inv.id, sort_order: i }))
        )
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
        <h1 className="text-sm font-bold text-gray-900">新規請求書</h1>
      </div>

      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">取引先</label>
            <select value={companyId} onChange={e => { setCompanyId(Number(e.target.value)); setProjectId(0) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>選択してください</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">工事名 *</label>
            <select value={projectId} onChange={e => setProjectId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>選択してください</option>
              {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">請求書番号 *</label>
            <input type="text" value={docNo} onChange={e => setDocNo(e.target.value)} placeholder="INV-2026-001"
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
            <span className="text-gray-600">小計</span><span>¥{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">消費税（10%）</span><span>¥{taxAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>合計</span><span>¥{totalAmount.toLocaleString()}</span>
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
