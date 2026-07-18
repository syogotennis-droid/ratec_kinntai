'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, Company, CompanyOffice, ProjectStatus } from '@/lib/supabase/types'
import MobileMenuButton from '@/components/ui/MobileMenuButton'

export interface ProjectWithCompany extends Project {
  companies?: { name: string } | null
  company_offices?: { name: string } | null
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-blue-50 text-blue-700 border border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '進行中',
  completed: '完了',
  cancelled: 'キャンセル',
}

type SortKey = 'name' | 'created_new' | 'created_old'

// 検索文字と一致した部分だけを<mark>で強調する(検索ロジック自体には影響しない、表示専用のヘルパー)
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'g'))
  return parts.map((part, i) => (part === query ? <mark key={i} className="search-highlight">{part}</mark> : part))
}

export default function ProjectsClient({ initialProjects, initialCompanies, initialOffices }: { initialProjects: ProjectWithCompany[]; initialCompanies: Company[]; initialOffices: CompanyOffice[] }) {
  const [projects, setProjects] = useState<ProjectWithCompany[]>(initialProjects)
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [offices, setOffices] = useState<CompanyOffice[]>(initialOffices)
  const [loading, setLoading] = useState(false)
  const [editProject, setEditProject] = useState<ProjectWithCompany | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('active')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [projectsRes, companiesRes, officesRes] = await Promise.all([
      supabase.from('projects').select('*, companies(name), company_offices(name)').order('name'),
      supabase.from('companies').select('*').eq('is_active', true).order('name'),
      supabase.from('company_offices').select('*').order('name'),
    ])
    setProjects(projectsRes.data ?? [])
    setCompanies(companiesRes.data ?? [])
    setOffices(officesRes.data ?? [])
    setLoading(false)
  }, [])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchData()
  }, [fetchData])

  const displayed = projects
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .filter(p => !search || p.name.includes(search) || p.companies?.name.includes(search) || p.company_offices?.name.includes(search))
    .slice()
    .sort((a, b) => {
      if (sort === 'created_new') return b.created_at.localeCompare(a.created_at)
      if (sort === 'created_old') return a.created_at.localeCompare(b.created_at)
      return a.name.localeCompare(b.name, 'ja')
    })

  const hasSearch = search.trim() !== ''
  const hasStatusFilter = filterStatus !== 'all'
  const isFiltered = hasSearch || hasStatusFilter
  const clearSearch = () => setSearch('')
  const clearAll = () => { setSearch(''); setFilterStatus('all') }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuButton />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900">案件管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">案件の登録・進捗確認</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow whitespace-nowrap shrink-0">
          ＋ 新規案件
        </button>
      </div>

      <div className="mb-1">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('')
              if (e.key === 'Enter') e.preventDefault()
            }}
            placeholder="案件名・取引先名で検索"
            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button type="button" onClick={clearSearch} aria-label="検索文字をクリア"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              ×
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">入力すると自動で絞り込みます</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex gap-1">
          {(['all', 'active', 'completed', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'すべて' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">案件名順</option>
          <option value="created_new">登録日が新しい順</option>
          <option value="created_old">登録日が古い順</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs text-gray-500">
        {hasSearch ? (
          <span>「{search}」の検索結果：{displayed.length}件</span>
        ) : (
          <span>{displayed.length}件</span>
        )}
        {hasSearch && (
          <button type="button" onClick={clearSearch} className="text-blue-600 hover:underline">検索を解除</button>
        )}
        {hasSearch && hasStatusFilter && (
          <div className="flex items-center gap-1">
            <span className="text-gray-400">検索条件：</span>
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 rounded-full pl-2 pr-1 py-0.5">
              {search}
              <button type="button" onClick={clearSearch} aria-label="検索文字の条件を解除" className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-200 hover:text-gray-900">×</button>
            </span>
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 rounded-full pl-2 pr-1 py-0.5">
              {STATUS_LABELS[filterStatus as ProjectStatus]}
              <button type="button" onClick={() => setFilterStatus('all')} aria-label="ステータス条件を解除" className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-200 hover:text-gray-900">×</button>
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="py-10 text-center border border-gray-200 rounded-lg bg-white">
          <p className="text-sm text-gray-500">{isFiltered ? '条件に一致する案件がありません' : '案件がありません'}</p>
          {isFiltered ? (
            <>
              <p className="text-xs text-gray-400 mt-1">検索文字やステータス条件を変更してください</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                {hasSearch && (
                  <button onClick={clearSearch}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    検索を解除
                  </button>
                )}
                <button onClick={clearAll}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  すべての条件を解除
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="mt-3 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow">
              ＋ 新規案件を作成
            </button>
          )}
        </div>
      ) : (
        <>
        {/* PC: 一覧表示 */}
        <div className="hidden lg:block border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="grid [grid-template-columns:1fr_1fr_120px_64px] gap-3 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500">
            <div>案件名</div>
            <div>取引先</div>
            <div>状態</div>
            <div />
          </div>
          <div className="divide-y divide-gray-100">
            {displayed.map(p => {
              const companyDisplay = `${p.companies?.name ?? ''}${p.company_offices?.name ? `（${p.company_offices.name}）` : ''}`
              return (
              <div key={p.id} onClick={() => setEditProject(p)}
                className="grid [grid-template-columns:1fr_1fr_120px_64px] gap-3 items-center px-3 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate" title={p.name}>{search ? highlightMatch(p.name, search) : p.name}</div>
                </div>
                <div className="min-w-0 text-sm text-gray-500 truncate" title={p.companies?.name || undefined}>
                  {search ? highlightMatch(companyDisplay, search) : companyDisplay}
                </div>
                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[p.status as ProjectStatus] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                    {STATUS_LABELS[p.status as ProjectStatus] ?? p.status}
                  </span>
                </div>
                <div className="text-right text-sm text-blue-600 font-medium whitespace-nowrap">詳細 ›</div>
              </div>
              )
            })}
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="lg:hidden space-y-2">
          {displayed.map(p => {
            const companyDisplay = `${p.companies?.name ?? ''}${p.company_offices?.name ? `（${p.company_offices.name}）` : ''}`
            return (
            <div key={p.id} onClick={() => setEditProject(p)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-md transition-all">
              <div className="text-sm font-semibold text-gray-900 truncate" title={p.name}>{search ? highlightMatch(p.name, search) : p.name}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {search ? highlightMatch(companyDisplay, search) : companyDisplay}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[p.status as ProjectStatus] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                  {STATUS_LABELS[p.status as ProjectStatus] ?? p.status}
                </span>
                <span className="text-xs text-blue-600 font-medium">詳細を見る ›</span>
              </div>
            </div>
            )
          })}
        </div>
        </>
      )}

      {(showAdd || editProject) && (
        <ProjectModal
          project={editProject}
          companies={companies}
          offices={offices}
          onClose={() => { setShowAdd(false); setEditProject(null) }}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

interface ProjectModalProps {
  project?: ProjectWithCompany | null
  companies: Company[]
  offices: CompanyOffice[]
  onClose: () => void
  onSaved: () => void
}

function ProjectModal({ project, companies, offices, onClose, onSaved }: ProjectModalProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [companyId, setCompanyId] = useState(project?.company_id ?? 0)
  const [companySearch, setCompanySearch] = useState(
    project ? (companies.find(c => c.id === project.company_id)?.name ?? '') : ''
  )
  const [companyOpen, setCompanyOpen] = useState(false)
  const [officeId, setOfficeId] = useState(project?.office_id ?? 0)
  const [status, setStatus] = useState<ProjectStatus>(project?.status as ProjectStatus ?? 'active')
  const [notes, setNotes] = useState(project?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredCompanies = companies.filter(c =>
    !companySearch || c.name.includes(companySearch) || offices.some(o => o.company_id === c.id && o.name.includes(companySearch))
  )

  const companyOffices = offices.filter(o => o.company_id === companyId)
  const needsOffice = companyOffices.length > 0

  const handleSelectCompany = (c: Company) => {
    setCompanyId(c.id)
    setCompanySearch(c.name)
    setCompanyOpen(false)
    if (c.id !== companyId) setOfficeId(0)
  }

  const handleSave = async () => {
    if (!name || !companyId) return
    if (needsOffice && !officeId) return
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = { name, company_id: companyId, office_id: needsOffice ? officeId : null, status, notes: notes || null }
      if (project) {
        await supabase.from('projects').update(payload).eq('id', project.id)
      } else {
        await supabase.from('projects').insert(payload)
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">{project ? '案件名を編集' : '案件名を追加'}</h2>
        <div className="space-y-3">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">取引先 *</label>
            <input
              type="text"
              value={companySearch}
              onChange={e => { setCompanySearch(e.target.value); setCompanyOpen(true) }}
              onFocus={() => setCompanyOpen(true)}
              placeholder="会社名で検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {companyId > 0 && !companyOpen && (
              <p className="text-xs text-blue-600 mt-0.5">
                選択中: {companies.find(c => c.id === companyId)?.name}
              </p>
            )}
            {companyOpen && filteredCompanies.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCompanies.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => handleSelectCompany(c)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0 ${companyId === c.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {needsOffice && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">事業所 *</label>
              <select value={officeId} onChange={e => setOfficeId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={0}>選択してください</option>
                {companyOffices.map(o => (
                  <option key={o.id} value={o.id}>{o.name}（{o.address}）</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">住所が事業所ごとに異なるため、選択が必要です</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">案件名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ステータス</label>
            <select value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">進行中</option>
              <option value="completed">完了</option>
              <option value="cancelled">キャンセル</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !name || !companyId || (needsOffice && !officeId)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
