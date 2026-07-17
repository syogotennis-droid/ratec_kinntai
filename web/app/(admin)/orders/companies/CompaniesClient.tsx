'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Company, CompanyContact } from '@/lib/supabase/types'
import MobileMenuButton from '@/components/ui/MobileMenuButton'

export default function CompaniesClient({ initialCompanies }: { initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [loading, setLoading] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('companies').select('*').order('address')
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
    .filter(c => !search || c.name.includes(search) || c.tel.includes(search) || c.email.includes(search))

  const isFiltered = search.trim() !== ''

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuButton />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900">取引先管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">取引先情報を登録・管理します</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow whitespace-nowrap shrink-0"
        >
          ＋ 取引先を追加
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="会社名・電話番号・メールアドレスで検索"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />

      <div className="text-xs text-gray-500 mb-2">{displayed.length}件</div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500">{isFiltered ? '該当する取引先がありません' : '取引先がありません'}</p>
          {!isFiltered && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-block mt-3 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow"
            >
              ＋ 取引先を追加
            </button>
          )}
        </div>
      ) : (
        <>
        {/* PC: 一覧表示 */}
        <div className="hidden lg:block border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="grid [grid-template-columns:2fr_1.4fr_140px_200px_64px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500">
            <div>会社名</div>
            <div>住所</div>
            <div>電話番号</div>
            <div>メールアドレス</div>
            <div />
          </div>
          <div className="divide-y divide-gray-100">
            {displayed.map(c => (
              <div
                key={c.id}
                onClick={() => setEditCompany(c)}
                className={`grid [grid-template-columns:2fr_1.4fr_140px_200px_64px] gap-2 items-center px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${!c.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate" title={c.name}>{c.name}</span>
                  {!c.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">非表示</span>}
                </div>
                <div className="text-sm text-gray-500 truncate" title={c.address || undefined}>{c.address || '—'}</div>
                <div className="text-sm text-gray-500 truncate">{c.tel || '未登録'}</div>
                <div className="text-sm text-gray-500 truncate">{c.email || '未登録'}</div>
                <div className="text-right text-sm text-blue-600 font-medium whitespace-nowrap">編集 ›</div>
              </div>
            ))}
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="lg:hidden space-y-2">
          {displayed.map(c => (
            <div
              key={c.id}
              onClick={() => setEditCompany(c)}
              className={`bg-white border border-gray-200 rounded-lg shadow-sm p-3 hover:shadow-md transition-all cursor-pointer ${!c.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate" title={c.name}>{c.name}</span>
                {!c.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">非表示</span>}
              </div>
              <div className="text-xs text-gray-500 truncate mt-1">{c.tel || '未登録'}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{c.email || '未登録'}</div>
              <div className="flex justify-end mt-2">
                <span className="text-xs text-blue-600 font-medium">編集 ›</span>
              </div>
            </div>
          ))}
        </div>
        </>
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
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

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
    const trimmedName = name.trim()
    const emailInvalid = email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setNameError(trimmedName ? null : '会社名を入力してください')
    setEmailError(emailInvalid ? 'メールアドレスの形式が正しくありません（例：example@example.com）' : null)
    if (!trimmedName || emailInvalid) return
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
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-6 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {company ? '取引先を編集' : '取引先を追加'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">会社名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${nameError ? 'border-red-400' : 'border-gray-300'}`} />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号（任意）</label>
              <input type="text" value={postal} onChange={e => setPostal(e.target.value)} placeholder="650-0011"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">住所（任意）</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号（任意）</label>
              <input type="text" value={tel} onChange={e => setTel(e.target.value)} placeholder="090-1234-5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FAX（任意）</label>
              <input type="text" value={fax} onChange={e => setFax(e.target.value)} placeholder="090-1234-5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス（任意）</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@example.com"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-400' : 'border-gray-300'}`} />
            {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
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
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-lg shadow-sm">
            {saving ? '保存中...' : company ? '変更を保存' : '取引先を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
