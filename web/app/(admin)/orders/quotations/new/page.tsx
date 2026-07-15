'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, CompanyOffice, Project, DocumentItem } from '@/lib/supabase/types'
import Link from 'next/link'
import MitsubishiSearch from '@/components/MitsubishiSearch'
import { Win2kResult } from '@/lib/win2k'

const TAX_RATE = 0.1

interface ProjectWithCompany extends Project {
  companyData: Company
}

export default function NewQuotationPage() {
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [offices, setOffices] = useState<CompanyOffice[]>([])
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectWithCompany | null>(null)
  const [projectId, setProjectId] = useState<number>(0)
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
      supabase.from('company_offices').select('*'),
    ]).then(([c, p, o]) => {
      setCompanies(c.data ?? [])
      setProjects(p.data ?? [])
      setOffices(o.data ?? [])
    })
  }, [])

  const generateDocNo = async () => {
    const today = new Date().toLocaleDateString('sv-SE')
    const mmdd = today.slice(5, 7) + today.slice(8, 10)
    const { data } = await createClient()
      .from('quotations')
      .select('doc_no')
      .like('doc_no', `${mmdd}-%`)
    const maxN = (data ?? []).reduce((max, q) => {
      const n = parseInt(q.doc_no.split('-')[1] ?? '0')
      return Math.max(max, isNaN(n) ? 0 : n)
    }, 0)
    return `${mmdd}-${maxN + 1}`
  }

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
    ? projectsWithCompany.filter(p => p.name.includes(search) || p.companyData.name.includes(search))
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
  }

  const office = selectedProject?.office_id ? offices.find(o => o.id === selectedProject.office_id) : null
  const resolvedPostal = office?.postal ?? selectedProject?.companyData.postal ?? ''
  const resolvedAddress = office?.address ?? selectedProject?.companyData.address ?? ''

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

  const applyWin2kResult = (idx: number, result: Win2kResult) => {
    setItems(prev => {
      const next = [...prev]
      const unitPrice = result.price ?? next[idx].unit_price
      next[idx] = { ...next[idx], name: result.code, spec: result.category, unit_price: unitPrice, amount: next[idx].qty * unitPrice }
      return next
    })
  }

  const handleSave = async () => {
    if (!projectId) { setError('工事名を選択してください'); return }
    setError(null)
    setSaving(true)
    try {
      const docNo = await generateDocNo()
      const supabase = createClient()
      const { data: q, error: qErr } = await supabase.from('quotations').insert({
        project_id: projectId,
        doc_no: docNo,
        issue_date: issueDate,
        status: '作成中',
        notes: notes || null,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      }).select().single()
      if (qErr) throw qErr
      if (items.length > 0) {
        await supabase.from('quotation_items').insert(items.map((item, i) => ({ ...item, quotation_id: q.id, sort_order: i })))
      }
      router.push(`/orders/quotations/${q.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/orders/quotations" className="text-sm text-blue-600 hover:underline">← 一覧</Link>
        <h1 className="text-sm font-bold text-gray-900">新規見積書</h1>
      </div>
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">工事名 *</label>
          <div className="relative" ref={searchRef}>
            {selectedProject ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <span className="text-xs text-gray-500">{selectedProject.companyData.name}</span>
                <span className="text-sm text-gray-900 flex-1">{selectedProject.name}</span>
                <button onClick={() => { setSelectedProject(null); setProjectId(0) }}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">住所</label>
            <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-gray-50 min-h-[38px]">
              {selectedProject ? (
                <>{resolvedPostal && `〒${resolvedPostal} `}{resolvedAddress || '—'}</>
              ) : '—'}
            </div>
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
          <button onClick={() => setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '台', unit_price: 0, amount: 0 }])} className="text-xs text-blue-600 hover:underline">+ 行追加</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200">
                {['型式検索(三菱)', '品名', '仕様', '数量', '単位', '単価', '金額', ''].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 px-1"><MitsubishiSearch onSelect={r => applyWin2kResult(idx, r)} /></td>
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
