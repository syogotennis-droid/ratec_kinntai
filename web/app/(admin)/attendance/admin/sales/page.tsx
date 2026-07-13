'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, SalesRecord } from '@/lib/supabase/types'

interface SalesWithProfile extends SalesRecord {
  profile?: Profile
}

export default function AdminSalesPage() {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [records, setRecords] = useState<SalesWithProfile[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [modal, setModal] = useState<{ record?: SalesRecord | null; date?: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const [recordsRes, profilesRes] = await Promise.all([
      supabase.from('sales_records').select('*')
        .gte('record_date', `${yearMonth}-01`)
        .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
        .order('record_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
    ])
    const profileList = profilesRes.data ?? []
    setProfiles(profileList)
    const profileMap = Object.fromEntries(profileList.map(p => [p.id, p]))
    setRecords((recordsRes.data ?? []).map(r => ({ ...r, profile: profileMap[r.user_id] })))
    setLoading(false)
  }, [yearMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = filterUserId === 'all' ? records : records.filter(r => r.user_id === filterUserId)
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)

  const prevMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
          <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterUserId}
            onChange={e => setFilterUserId(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全員</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setModal({ date: new Date().toISOString().slice(0, 10) })}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            + 追加
          </button>
        </div>
      </div>

      <div className="mb-3 text-sm font-medium text-gray-900">
        合計: ¥{totalAmount.toLocaleString()}
        <span className="text-xs text-gray-500 ml-2">（{filtered.length}件）</span>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">記録がありません</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div
              key={r.id}
              onClick={() => setModal({ record: r })}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="w-16 text-xs text-gray-500 shrink-0">
                {r.record_date.slice(5).replace('-', '/')}
              </div>
              <div className="text-xs text-gray-500 w-20 shrink-0 truncate">
                {r.profile?.name ?? '—'}
              </div>
              <div className="flex-1 text-sm text-gray-900 truncate">{r.description || '—'}</div>
              <div className="text-sm font-medium text-gray-900 shrink-0">¥{r.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <AdminSalesModal
          profiles={profiles}
          record={modal.record}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

interface AdminSalesModalProps {
  profiles: Profile[]
  record?: SalesRecord | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

function AdminSalesModal({ profiles, record, defaultDate, onClose, onSaved }: AdminSalesModalProps) {
  const [userId, setUserId] = useState(record?.user_id ?? profiles[0]?.id ?? '')
  const [date, setDate] = useState(record?.record_date ?? defaultDate ?? '')
  const [amount, setAmount] = useState(String(record?.amount ?? ''))
  const [description, setDescription] = useState(record?.description ?? '')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        user_id: userId,
        record_date: date,
        amount: Number(amount) || 0,
        description: description || null,
        notes: notes || null,
      }
      if (record) {
        await supabase.from('sales_records').update(payload).eq('id', record.id)
      } else {
        await supabase.from('sales_records').insert(payload)
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!record || !confirm('削除しますか？')) return
    setSaving(true)
    try {
      await createClient().from('sales_records').delete().eq('id', record.id)
      onSaved()
      onClose()
    } catch {
      setError('削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {record ? '売上記録を編集' : '売上記録を追加'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">従業員</label>
            <select value={userId} onChange={e => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">金額（円）</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">内容</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          {record && <button onClick={handleDelete} disabled={saving} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !date || !userId}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
