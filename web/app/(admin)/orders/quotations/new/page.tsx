'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Company, CompanyOffice, Project, QuotationItem } from '@/lib/supabase/types'
import Link from 'next/link'
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

const TAX_RATE = 0.1

// 品名はExcel上は1セル(改行区切り2行)だが、システム上は品名・型番を分けて入力できるようにする
function splitName(name: string): [string, string] {
  const idx = name.indexOf('\n')
  return idx === -1 ? [name, ''] : [name.slice(0, idx), name.slice(idx + 1)]
}
function joinName(line1: string, line2: string): string {
  return line2 ? `${line1}\n${line2}` : line1
}

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
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithCompany | null>(null)
  const [projectId, setProjectId] = useState<number>(0)
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<QuotationItem, 'id'>[]>([
    { sort_order: 0, name: '', spec: '', qty: 1, unit: '式', unit_price: 0, amount: 0, markup_rate: 0.3, purchase_rate: 0.2, item_type: 'product' }
  ])
  const [itemLinks, setItemLinks] = useState<(string | null)[]>([null])
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

  const flatResults = Object.values(grouped).flatMap(g => g.projs)

  const selectProject = (p: ProjectWithCompany) => {
    setSelectedProject(p)
    setProjectId(p.id)
    setSearch('')
    setShowResults(false)
    setHighlightIndex(-1)
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

  const office = selectedProject?.office_id ? offices.find(o => o.id === selectedProject.office_id) : null
  const resolvedPostal = office?.postal ?? selectedProject?.companyData.postal ?? ''
  const resolvedAddress = office?.address ?? selectedProject?.companyData.address ?? ''

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const taxAmount = Math.floor(subtotal * TAX_RATE)
  const totalAmount = subtotal + taxAmount

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

  const handleSave = async () => {
    if (!projectId) { setError('案件名を選択してください'); return }
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
          <label className="block text-xs font-medium text-gray-700 mb-1">案件名 *</label>
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
          <button onClick={() => { setItems(prev => [...prev, { sort_order: prev.length, name: '', spec: '', qty: 1, unit: '式', unit_price: 0, amount: 0, markup_rate: 0.3, purchase_rate: 0.2, item_type: 'product' }]); setItemLinks(prev => [...prev, null]) }} className="text-xs text-blue-600 hover:underline">+ 行追加</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200">
                {['種別', '型式検索', '品名', '数量', 'メーカー希望小売価格', '仕切掛け率', '仕切り価格', '金額', ''].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isLabor = item.item_type === 'labor'
                return (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 px-1">
                    <select value={item.item_type} onChange={e => updateItem(idx, 'item_type', e.target.value)}
                      className="px-1 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="product">商品</option>
                      <option value="labor">作業</option>
                    </select>
                  </td>
                  <td className="py-1 px-1">
                    {isLabor ? <span className="text-gray-300">—</span> : <ProductModelSearch makers={MAKERS} onSelect={(r, m) => applyWin2kResult(idx, r, m)} />}
                  </td>
                  <td className="py-1 px-1">
                    {isLabor ? (
                      <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-48 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    ) : (
                      <div className="flex items-start gap-1">
                        <div className="flex flex-col gap-0.5 w-48">
                          <input value={splitName(item.name)[0]} onChange={e => updateItem(idx, 'name', joinName(e.target.value, splitName(item.name)[1]))}
                            placeholder="品名" className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <input value={splitName(item.name)[1]} onChange={e => updateItem(idx, 'name', joinName(splitName(item.name)[0], e.target.value))}
                            placeholder="型番" className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
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
                    )}
                  </td>
                  <td className="py-1 px-1"><input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} min={0} className="w-14 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-1 px-1">
                    {isLabor ? <span className="text-gray-300">—</span> : (
                      <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0} className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    )}
                  </td>
                  <td className="py-1 px-1">
                    {isLabor ? <span className="text-gray-300">—</span> : (
                      <input type="number" step="0.01" value={item.markup_rate} onChange={e => updateItem(idx, 'markup_rate', Number(e.target.value))} min={0} className="w-16 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    )}
                  </td>
                  <td className="py-1 px-1">
                    {isLabor ? (
                      <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} min={0} className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    ) : `¥${Math.round(item.unit_price * item.markup_rate).toLocaleString()}`}
                  </td>
                  <td className="py-1 px-2 text-right font-medium">¥{item.amount.toLocaleString()}</td>
                  <td className="py-1 px-1"><button onClick={() => { setItems(prev => prev.filter((_, i) => i !== idx)); setItemLinks(prev => prev.filter((_, i) => i !== idx)) }} className="text-red-400 hover:text-red-600">×</button></td>
                </tr>
              )})}
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
