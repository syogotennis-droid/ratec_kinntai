'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Company, CompanyContact } from '@/lib/supabase/types'
import { useSidebar } from '@/lib/sidebar-context'

export default function CompaniesClient({ initialCompanies }: { initialCompanies: Company[] }) {
  const openSidebar = useSidebar()
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [loading, setLoading] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('companies').select('*').order('name')
    setCompanies(data ?? [])
    setLoading(false)
  }, [])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchCompanies()
  }, [fetchCompanies])

  const displayed = companies
    .filter(c => showInactive ? true : c.is_active)
    .filter(c => !search || c.name.includes(search))

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={openSidebar} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="会社名で検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap"
        >
          + 追加
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">会社がありません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(c => (
            <div
              key={c.id}
              onClick={() => setEditCompany(c)}
              className={`p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors ${!c.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 flex-1">{c.name}</p>
                {!c.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">非表示</span>}
              </div>
              {(c.tel || c.email) && (
                <p className="text-xs text-gray-400 mt-0.5">{[c.tel, c.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {(showAdd || editCompany) && (
        <CompanyModal
          company={editCompany}
          onClose={() => { setShowAdd(false); setEditCompany(null) }}
          onSaved={fetchCompanies}
        />
      )}
    </div>
  )
}

interface CompanyModalProps {
  company?: Company | null
  onClose: () => void
  onSaved: () => void
}

function CompanyModal({ company, onClose, onSaved }: CompanyModalProps) {
  const [name, setName] = useState(company?.name ?? '')
  const [postal, setPostal] = useState(company?.postal ?? '')
  const [address, setAddress] = useState(company?.address ?? '')
  const [tel, setTel] = useState(company?.tel ?? '')
  const [fax, setFax] = useState(company?.fax ?? '')
  const [email, setEmail] = useState(company?.email ?? '')
  const [notes, setNotes] = useState(company?.notes ?? '')
  const [isActive, setIsActive] = useState(company?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [newContactName, setNewContactName] = useState('')
  const [newContactPosition, setNewContactPosition] = useState('')
  const [addingContact, setAddingContact] = useState(false)

  useEffect(() => {
    if (!company) return
    createClient().from('company_contacts').select('*').eq('company_id', company.id).order('created_at').then(({ data }) => {
      setContacts(data ?? [])
    })
  }, [company])

  const handleAddContact = async () => {
    if (!newContactName || !company) return
    setAddingContact(true)
    const { data } = await createClient().from('company_contacts').insert({
      company_id: company.id,
      name: newContactName,
      position: newContactPosition || null,
    }).select().single()
    if (data) setContacts(prev => [...prev, data])
    setNewContactName('')
    setNewContactPosition('')
    setAddingContact(false)
  }

  const handleDeleteContact = async (id: number) => {
    await createClient().from('company_contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const handleSave = async () => {
    if (!name) return
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = { name, postal, address, tel, fax, email, notes: notes || null, is_active: isActive }
      if (company) {
        await supabase.from('companies').update(payload).eq('id', company.id)
      } else {
        await supabase.from('companies').insert(payload)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {company ? '会社を編集' : '会社を追加'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">会社名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">郵便番号</label>
            <input type="text" value={postal} onChange={e => setPostal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">住所</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">電話</label>
              <input type="text" value={tel} onChange={e => setTel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">FAX</label>
              <input type="text" value={fax} onChange={e => setFax(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {company && (
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              表示する
            </label>
          )}

          {company && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-700 mb-2">担当者</p>
              <div className="space-y-1.5 mb-2">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 text-gray-800">{c.name}{c.position && <span className="text-gray-400 ml-1">（{c.position}）</span>}</span>
                    <button onClick={() => handleDeleteContact(c.id)} className="text-red-400 hover:text-red-600">×</button>
                  </div>
                ))}
                {contacts.length === 0 && <p className="text-xs text-gray-400">担当者なし</p>}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  placeholder="氏名"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newContactPosition}
                  onChange={e => setNewContactPosition(e.target.value)}
                  placeholder="役職（任意）"
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddContact}
                  disabled={!newContactName || addingContact}
                  className="px-2 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded"
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !name}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
