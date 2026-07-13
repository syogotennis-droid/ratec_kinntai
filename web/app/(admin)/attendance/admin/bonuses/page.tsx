'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Bonus } from '@/lib/supabase/types'

interface BonusRow {
  profile: Profile
  bonus: Bonus | null
}

export default function BonusesPage() {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<BonusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editRow, setEditRow] = useState<BonusRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [profilesRes, bonusesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
      supabase.from('bonuses').select('*').eq('year_month', yearMonth),
    ])
    const profiles = profilesRes.data ?? []
    const bonuses = bonusesRes.data ?? []
    setRows(profiles.map(profile => ({
      profile,
      bonus: bonuses.find(b => b.user_id === profile.id) ?? null,
    })))
    setLoading(false)
  }, [yearMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const totalBonus = rows.reduce((s, r) => s + (r.bonus?.bonus_amount ?? 0), 0)

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
      <div className="flex items-center gap-2 mb-4">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
        <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">合計 ¥{totalBonus.toLocaleString()}</span>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.profile.id}
              onClick={() => setEditRow(row)}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{row.profile.name}</p>
                <p className="text-xs text-gray-400">{row.profile.employee_id}</p>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {row.bonus ? `¥${row.bonus.bonus_amount.toLocaleString()}` : <span className="text-gray-400">未設定</span>}
              </div>
              {row.bonus?.notes && (
                <div className="text-xs text-gray-400 max-w-24 truncate">{row.bonus.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {editRow && (
        <BonusModal
          row={editRow}
          yearMonth={yearMonth}
          onClose={() => setEditRow(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

interface BonusModalProps {
  row: BonusRow
  yearMonth: string
  onClose: () => void
  onSaved: () => void
}

function BonusModal({ row, yearMonth, onClose, onSaved }: BonusModalProps) {
  const [amount, setAmount] = useState(String(row.bonus?.bonus_amount ?? ''))
  const [notes, setNotes] = useState(row.bonus?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        user_id: row.profile.id,
        year_month: yearMonth,
        bonus_amount: Number(amount) || 0,
        notes: notes || null,
      }
      if (row.bonus) {
        await supabase.from('bonuses').update(payload).eq('id', row.bonus.id)
      } else {
        await supabase.from('bonuses').insert(payload)
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
        <h2 className="text-base font-bold text-gray-900 mb-1">ボーナス設定</h2>
        <p className="text-xs text-gray-500 mb-4">{row.profile.name} / {yearMonth.replace('-', '年')}月</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">金額（円）</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0}
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
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
