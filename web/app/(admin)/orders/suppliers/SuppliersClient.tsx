'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Supplier } from '@/lib/supabase/types'
import MobileMenuButton from '@/components/ui/MobileMenuButton'

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [loading, setLoading] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('suppliers').select('*').order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }, [])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchSuppliers()
  }, [fetchSuppliers])

  const displayed = suppliers
    .filter(s => showInactive ? true : s.is_active)
    .filter(s => !search || s.name.includes(search) || s.tel.includes(search) || s.email.includes(search))

  const isFiltered = search.trim() !== ''

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuButton />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900">仕入先管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">仕入先情報を登録・管理します</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow whitespace-nowrap shrink-0">
          ＋ 仕入先を追加
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="仕入先名・電話番号・メールアドレスで検索"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap shrink-0">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          非表示含む
        </label>
      </div>

      <div className="text-xs text-gray-500 mb-2">{displayed.length}件</div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500">{isFiltered ? '該当する仕入先がありません' : '仕入先がありません'}</p>
          {!isFiltered && (
            <button onClick={() => setShowAdd(true)}
              className="inline-block mt-3 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow">
              ＋ 仕入先を追加
            </button>
          )}
        </div>
      ) : (
        <>
        {/* PC: 一覧表示 */}
        <div className="hidden lg:block border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="grid [grid-template-columns:2fr_72px_1.2fr_140px_200px_64px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500">
            <div>仕入先名</div>
            <div>種別</div>
            <div>住所</div>
            <div>電話番号</div>
            <div>メールアドレス</div>
            <div />
          </div>
          <div className="divide-y divide-gray-100">
            {displayed.map(s => (
              <div key={s.id} onClick={() => setEditSupplier(s)}
                className={`grid [grid-template-columns:2fr_72px_1.2fr_140px_200px_64px] gap-2 items-center px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate" title={s.name}>{s.name}</span>
                  {!s.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">非表示</span>}
                </div>
                <div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">{s.supplier_type}</span>
                </div>
                <div className="text-sm text-gray-500 truncate" title={s.address || undefined}>{s.address || '—'}</div>
                <div className="text-sm text-gray-500 truncate">{s.tel || '未登録'}</div>
                <div className="text-sm text-gray-500 truncate">{s.email || '未登録'}</div>
                <div className="text-right text-sm text-blue-600 font-medium whitespace-nowrap">編集 ›</div>
              </div>
            ))}
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="lg:hidden space-y-2">
          {displayed.map(s => (
            <div key={s.id} onClick={() => setEditSupplier(s)}
              className={`bg-white border border-gray-200 rounded-lg shadow-sm p-3 hover:shadow-md transition-all cursor-pointer ${!s.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate" title={s.name}>{s.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">{s.supplier_type}</span>
                  {!s.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">非表示</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500 truncate mt-1">{s.tel || '未登録'}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{s.email || '未登録'}</div>
              <div className="flex justify-end mt-2">
                <span className="text-xs text-blue-600 font-medium">編集 ›</span>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {(showAdd || editSupplier) && (
        <SupplierModal
          supplier={editSupplier}
          onClose={() => { setShowAdd(false); setEditSupplier(null) }}
          onSaved={fetchSuppliers}
        />
      )}
    </div>
  )
}

interface SupplierModalProps {
  supplier?: Supplier | null
  onClose: () => void
  onSaved: () => void
}

function SupplierModal({ supplier, onClose, onSaved }: SupplierModalProps) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [supplierType, setSupplierType] = useState<'直販' | '代理店'>(supplier?.supplier_type ?? '直販')
  const [postal, setPostal] = useState(supplier?.postal ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [tel, setTel] = useState(supplier?.tel ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [isActive, setIsActive] = useState(supplier?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSave = async () => {
    const trimmedName = name.trim()
    const emailInvalid = email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setNameError(trimmedName ? null : '仕入先名を入力してください')
    setEmailError(emailInvalid ? 'メールアドレスの形式が正しくありません（例：example@example.com）' : null)
    if (!trimmedName || emailInvalid) return
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = { name, supplier_type: supplierType, postal, address, tel, email, notes: notes || null, is_active: isActive }
      if (supplier) {
        await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      } else {
        await supabase.from('suppliers').insert(payload)
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
        <h2 className="text-base font-bold text-gray-900 mb-4">{supplier ? '仕入先を編集' : '仕入先を追加'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">仕入先名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${nameError ? 'border-red-400' : 'border-gray-300'}`} />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">種別（任意）</label>
              <select value={supplierType} onChange={e => setSupplierType(e.target.value as '直販' | '代理店')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="直販">直販</option>
                <option value="代理店">代理店</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号（任意）</label>
              <input type="text" value={postal} onChange={e => setPostal(e.target.value)} placeholder="650-0011"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">住所（任意）</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号（任意）</label>
              <input type="text" value={tel} onChange={e => setTel(e.target.value)} placeholder="090-1234-5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス（任意）</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@example.com"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-400' : 'border-gray-300'}`} />
              {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {supplier && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              表示する
            </label>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-lg shadow-sm">
            {saving ? '保存中...' : supplier ? '変更を保存' : '仕入先を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
