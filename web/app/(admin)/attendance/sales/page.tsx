'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SalesRecord } from '@/lib/supabase/types'

interface SalesModal {
  record?: SalesRecord | null
  date?: string
}

export default function MySalesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<SalesModal | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchRecords = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('sales_records')
      .select('*')
      .eq('user_id', userId)
      .gte('record_date', `${yearMonth}-01`)
      .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('record_date', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [userId, yearMonth])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const totalAmount = records.reduce((s, r) => s + r.amount, 0)

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

  if (!userId) return <div className="p-6 text-sm text-gray-500">読み込み中...</div>

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">‹</button>
          <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">›</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            合計 ¥{totalAmount.toLocaleString()}
          </span>
          <button
            onClick={() => setModal({ date: new Date().toISOString().slice(0, 10) })}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            + 追加
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">記録がありません</div>
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <div
              key={r.id}
              onClick={() => setModal({ record: r })}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="w-16 text-xs text-gray-500 shrink-0">
                {r.record_date.slice(5).replace('-', '/')}
              </div>
              <div className="flex-1 text-sm text-gray-900 truncate">
                {r.description || '—'}
              </div>
              <div className="text-sm font-medium text-gray-900 shrink-0">
                ¥{r.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <SalesModal
          userId={userId}
          record={modal.record}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={fetchRecords}
        />
      )}
    </div>
  )
}

interface SalesModalProps {
  userId: string
  record?: SalesRecord | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

function SalesModal({ userId, record, defaultDate, onClose, onSaved }: SalesModalProps) {
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
          {record && (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !date}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
