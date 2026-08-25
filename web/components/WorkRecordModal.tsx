'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkRecord, WorkType } from '@/lib/supabase/types'

// 従業員側(予定カレンダー)の勤怠入力と揃えるため、選択できる勤務区分は
// 通常・有休・時間休の3種類のみ。残業・休日出勤は自動計算されるため手入力の対象外
// (勤怠管理の集計ロジック側で実働時間から自動算出している)
const WORK_TYPES: { value: WorkType; label: string; color: string }[] = [
  { value: 'normal', label: '通常', color: '#16a34a' },
  { value: 'paid_leave', label: '有休', color: '#9333ea' },
  { value: 'hourly_leave', label: '時間休', color: '#0891b2' },
]

const LEGACY_LABELS: Partial<Record<WorkType, string>> = {
  overtime: '残業',
  holiday: '休日',
  training: '研修',
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// 終了時刻が開始時刻以下の場合は日をまたぐ勤務とみなし、終了時刻に24時間分足して計算する
// (24時間以上勤務することは無い前提)
function calcActualMinutes(start: string, end: string, breakMin: number) {
  const startMin = toMinutes(start)
  let endMin = toMinutes(end)
  if (endMin <= startMin) endMin += 24 * 60
  return Math.max(0, endMin - startMin - breakMin)
}

interface Props {
  userId: string
  date?: string
  record?: WorkRecord | null
  onClose: () => void
  onSaved: () => void
}

export default function WorkRecordModal({ userId, date, record, onClose, onSaved }: Props) {
  const [workDate, setWorkDate] = useState(record?.work_date ?? date ?? '')
  const [startTime, setStartTime] = useState(record?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(record?.end_time?.slice(0, 5) ?? '18:00')
  const [breakMin, setBreakMin] = useState(record?.break_minutes ?? 60)
  const [workType, setWorkType] = useState<WorkType>(record?.work_type ?? 'normal')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPaidLeave = workType === 'paid_leave'

  // 既存データが旧区分(残業・休日・研修)の場合、選択肢から消えていても
  // そのまま表示・保存できるよう一時的に選べる候補に加える
  const options = WORK_TYPES.some(t => t.value === workType)
    ? WORK_TYPES
    : [...WORK_TYPES, { value: workType, label: LEGACY_LABELS[workType] ?? workType, color: '#6b7280' }]

  const yearMonth = workDate.slice(0, 7)

  const checkClosed = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('monthly_closings')
      .select('status')
      .eq('user_id', userId)
      .eq('year_month', yearMonth)
      .single()
    return data?.status === 'closed'
  }

  const handleSave = async () => {
    if (!workDate || (!isPaidLeave && (!startTime || !endTime))) return
    setError(null)
    setSaving(true)
    try {
      if (await checkClosed()) {
        setError('この月は締め済みのため編集できません')
        return
      }
      const supabase = createClient()
      const actual_minutes = isPaidLeave ? 0 : calcActualMinutes(startTime, endTime, breakMin)
      const payload = {
        user_id: userId,
        work_date: workDate,
        start_time: isPaidLeave ? '00:00' : startTime,
        end_time: isPaidLeave ? '00:00' : endTime,
        break_minutes: isPaidLeave ? 0 : breakMin,
        actual_minutes,
        work_type: workType,
        notes: notes || null,
      }
      if (record) {
        await supabase.from('work_records').update(payload).eq('id', record.id)
      } else {
        await supabase.from('work_records').insert(payload)
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
    setError(null)
    setSaving(true)
    try {
      if (await checkClosed()) {
        setError('この月は締め済みのため編集できません')
        return
      }
      const supabase = createClient()
      await supabase.from('work_records').delete().eq('id', record.id)
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const actualMin = calcActualMinutes(startTime, endTime, breakMin)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {record ? '勤怠を編集' : '勤怠を追加'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付 *</label>
            <input
              type="date"
              value={workDate}
              onChange={e => setWorkDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">勤務区分</label>
            <div className="flex flex-wrap gap-2">
              {options.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setWorkType(t.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    backgroundColor: workType === t.value ? t.color : 'white',
                    color: workType === t.value ? 'white' : '#374151',
                    borderColor: workType === t.value ? t.color : '#d1d5db',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {!isPaidLeave && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">開始時刻 *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">終了時刻 *</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">休憩時間（分）</label>
                  <select
                    value={breakMin}
                    onChange={e => setBreakMin(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[0, 15, 30, 45, 60, 75, 90, 120].map(m => (
                      <option key={m} value={m}>{m}分</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 pt-5">
                  <p className="text-xs text-gray-500">実働</p>
                  <p className="text-sm font-medium text-gray-900">
                    {Math.floor(actualMin / 60)}h{actualMin % 60 > 0 ? `${actualMin % 60}m` : ''}
                  </p>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          {record && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              削除
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !workDate || (!isPaidLeave && (!startTime || !endTime))}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
