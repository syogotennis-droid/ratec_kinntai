'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Project, Company, ProjectStatus } from '@/lib/supabase/types'

interface ProjectWithCompany extends Project {
  companies?: { name: string } | null
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '進行中',
  completed: '完了',
  cancelled: 'キャンセル',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithCompany[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [editProject, setEditProject] = useState<ProjectWithCompany | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('active')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [projectsRes, companiesRes] = await Promise.all([
      supabase.from('projects').select('*, companies(name)').order('name'),
      supabase.from('companies').select('*').eq('is_active', true).order('name'),
    ])
    setProjects(projectsRes.data ?? [])
    setCompanies(companiesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const displayed = projects
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .filter(p => !search || p.name.includes(search) || p.companies?.name.includes(search))

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="案件名・会社名で検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap">
          + 追加
        </button>
      </div>

      <div className="flex gap-1 mb-3">
        {(['all', 'active', 'completed', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s === 'all' ? '全て' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">案件がありません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => (
            <div key={p.id} onClick={() => setEditProject(p)}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.companies?.name}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[p.status as ProjectStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[p.status as ProjectStatus] ?? p.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editProject) && (
        <ProjectModal
          project={editProject}
          companies={companies}
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
  onClose: () => void
  onSaved: () => void
}

function ProjectModal({ project, companies, onClose, onSaved }: ProjectModalProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [companyId, setCompanyId] = useState(project?.company_id ?? (companies[0]?.id ?? 0))
  const [status, setStatus] = useState<ProjectStatus>(project?.status as ProjectStatus ?? 'active')
  const [notes, setNotes] = useState(project?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name || !companyId) return
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = { name, company_id: companyId, status, notes: notes || null }
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
        <h2 className="text-base font-bold text-gray-900 mb-4">{project ? '案件を編集' : '案件を追加'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">取引先 *</label>
            <select value={companyId} onChange={e => setCompanyId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
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
          <button onClick={handleSave} disabled={saving || !name || !companyId}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
