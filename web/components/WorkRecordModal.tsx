'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkRecord, WorkType } from '@/lib/supabase/types'

const WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: 'normal', label: '通常' },
  { value: 'overtime', label: '残業' },
  { value: 'holiday', label: '休日' },
  { value: 'training', label: '研修' },
  { value: 'paid_leave', label: '有給' },
]

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function calcActualMinutes(start: string, end: string, breakMin: number) {
  const diff = toMinutes(end) - toMinutes(start)
  return Math.max(0, diff - breakMin)
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
  const [startTime, setStartTime] = useState(record?.start_time ?? '09:00')
  const [endTime, setEndTime] = useState(record?.end_time ?? '18:00')
  const [breakMin, setBreakMin] = useState(record?.break_minutes ?? 60)
  const [workType, setWorkType] = useState<WorkType>(record?.work_type ?? 'normal')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!workDate) return
    setError(null)
    setSaving(true)
    try {
      if (await checkClosed()) {
        setError('この月は締め済みのため編集できません')
        return
      }
      const supabase = createClient()
      const actual_minutes = calcActualMinutes(startTime, endTime, breakMin)
      const payload = {
        user_id: userId,
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        break_minutes: breakMin,
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
          {record ? '勤務記録を編集' : '勤務記録を追加'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付</label>
            <input
              type="date"
              value={workDate}
              onChange={e => setWorkDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">開始</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">終了</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">休憩（分）</label>
              <input
                type="number"
                value={breakMin}
                onChange={e => setBreakMin(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 pt-5">
              <p className="text-xs text-gray-500">実働</p>
              <p className="text-sm font-medium text-gray-900">
                {Math.floor(actualMin / 60)}h{actualMin % 60 > 0 ? `${actualMin % 60}m` : ''}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">勤務種別</label>
            <select
              value={workType}
              onChange={e => setWorkType(e.target.value as WorkType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WORK_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

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
            disabled={saving || !workDate}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
