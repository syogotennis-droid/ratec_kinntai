'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Bonus } from '@/lib/supabase/types'
import MobileMenuButton from '@/components/ui/MobileMenuButton'

export interface BonusRow {
  profile: Profile
  bonus: Bonus | null
  lastYearBonus: Bonus | null
}

interface BonusesClientProps {
  initialYearMonth: string
  initialRows: BonusRow[]
}

function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

function total(b: Bonus | null): number {
  return (b?.salary_amount ?? 0) + (b?.bonus_amount ?? 0)
}

export default function BonusesClient({ initialYearMonth, initialRows }: BonusesClientProps) {
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [rows, setRows] = useState<BonusRow[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [editRow, setEditRow] = useState<BonusRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const lastYearMonth = prevYearMonth(yearMonth)
    const [profilesRes, bonusesRes, lastYearBonusesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
      supabase.from('bonuses').select('*').eq('year_month', yearMonth),
      supabase.from('bonuses').select('*').eq('year_month', lastYearMonth),
    ])
    const profiles = profilesRes.data ?? []
    const bonuses = bonusesRes.data ?? []
    const lastYearBonuses = lastYearBonusesRes.data ?? []
    setRows(profiles.map(profile => ({
      profile,
      bonus: bonuses.find(b => b.user_id === profile.id) ?? null,
      lastYearBonus: lastYearBonuses.find(b => b.user_id === profile.id) ?? null,
    })))
    setLoading(false)
  }, [yearMonth])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchData()
  }, [fetchData])

  const totalNow = rows.reduce((s, r) => s + total(r.bonus), 0)
  const totalLastYear = rows.reduce((s, r) => s + total(r.lastYearBonus), 0)
  const diff = totalNow - totalLastYear

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
      <div className="flex items-center gap-2 mb-3">
        <MobileMenuButton />
        <h1 className="text-base font-bold text-gray-900">給与・賞与管理</h1>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
        <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">合計 ¥{totalNow.toLocaleString()}</span>
      </div>
      <div className="text-right text-xs text-gray-400 mb-4">
        前年同月 ¥{totalLastYear.toLocaleString()}
        {totalLastYear > 0 && (
          <span className={`ml-1 font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            （{diff >= 0 ? '+' : ''}¥{diff.toLocaleString()}）
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const rowTotal = total(row.bonus)
            const rowLastYear = total(row.lastYearBonus)
            const rowDiff = rowTotal - rowLastYear
            return (
              <div
                key={row.profile.id}
                onClick={() => setEditRow(row)}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{row.profile.name}</p>
                  <p className="text-xs text-gray-400">{row.profile.employee_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {row.bonus ? `¥${rowTotal.toLocaleString()}` : <span className="text-gray-400">未設定</span>}
                  </p>
                  {row.bonus && (
                    <p className="text-[11px] text-gray-400">給与¥{(row.bonus.salary_amount ?? 0).toLocaleString()}・賞与¥{row.bonus.bonus_amount.toLocaleString()}</p>
                  )}
                  {rowLastYear > 0 && (
                    <p className="text-[11px] text-gray-400">
                      前年 ¥{rowLastYear.toLocaleString()}
                      <span className={rowDiff >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {' '}（{rowDiff >= 0 ? '+' : ''}¥{rowDiff.toLocaleString()}）
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
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
  const [salaryAmount, setSalaryAmount] = useState(String(row.bonus?.salary_amount ?? ''))
  const [bonusAmount, setBonusAmount] = useState(String(row.bonus?.bonus_amount ?? ''))
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
        salary_amount: Number(salaryAmount) || 0,
        bonus_amount: Number(bonusAmount) || 0,
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
        <h2 className="text-base font-bold text-gray-900 mb-1">給与・賞与設定</h2>
        <p className="text-xs text-gray-500 mb-4">{row.profile.name} / {yearMonth.replace('-', '年')}月</p>
        {row.lastYearBonus && (
          <p className="text-xs text-gray-400 mb-3">
            前年同月：給与¥{(row.lastYearBonus.salary_amount ?? 0).toLocaleString()}・賞与¥{row.lastYearBonus.bonus_amount.toLocaleString()}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">給与（円）</label>
            <input type="number" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">賞与（円）</label>
            <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} min={0}
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
