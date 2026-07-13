'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Supplier } from '@/lib/supabase/types'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const displayed = suppliers
    .filter(s => showInactive ? true : s.is_active)
    .filter(s => !search || s.name.includes(search))

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="仕入先名で検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          非表示含む
        </label>
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap">
          + 追加
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">仕入先がありません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(s => (
            <div key={s.id} onClick={() => setEditSupplier(s)}
              className={`p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 flex-1">{s.name}</p>
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.supplier_type}</span>
                {!s.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">非表示</span>}
              </div>
              {(s.tel || s.email) && (
                <p className="text-xs text-gray-400 mt-0.5">{[s.tel, s.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          ))}
        </div>
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

  const handleSave = async () => {
    if (!name) return
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
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">{supplier ? '仕入先を編集' : '仕入先を追加'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">仕入先名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">種別</label>
            <select value={supplierType} onChange={e => setSupplierType(e.target.value as '直販' | '代理店')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="直販">直販</option>
              <option value="代理店">代理店</option>
            </select>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">メール</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {supplier && (
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              表示する
            </label>
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
