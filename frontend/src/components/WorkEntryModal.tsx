import React, { useState, useEffect } from 'react'
import { WorkRecord } from '../types'

interface WorkEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: WorkEntryFormData) => Promise<void>
  onDelete?: () => Promise<void>
  initialDate?: string
  record?: WorkRecord | null
}

export interface WorkEntryFormData {
  work_date: string
  start_time: string
  end_time: string
  break_minutes: number
  work_type: 'normal' | 'overtime' | 'holiday' | 'training' | 'paid_leave'
  notes: string
}

const workTypeOptions = [
  { value: 'normal', label: '通常勤務' },
  { value: 'overtime', label: '残業' },
  { value: 'holiday', label: '休日出勤' },
  { value: 'training', label: '研修' },
  { value: 'paid_leave', label: '有給休暇' },
] as const

const breakOptions = [0, 30, 45, 60, 90]

function calcActualMinutes(start: string, end: string, breakMin: number): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let startTotal = sh * 60 + sm
  let endTotal = eh * 60 + em
  if (endTotal <= startTotal) endTotal += 24 * 60 // overnight
  const actual = endTotal - startTotal - breakMin
  return actual > 0 ? actual : 0
}

function formatMinutes(min: number | null): string {
  if (min === null) return '-'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

const WorkEntryModal: React.FC<WorkEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  record,
}) => {
  const [form, setForm] = useState<WorkEntryFormData>({
    work_date: initialDate ?? '',
    start_time: '09:00',
    end_time: '18:00',
    break_minutes: 60,
    work_type: 'normal',
    notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (record) {
      setForm({
        work_date: record.work_date,
        start_time: record.start_time,
        end_time: record.end_time,
        break_minutes: record.break_minutes,
        work_type: record.work_type,
        notes: record.notes ?? '',
      })
    } else if (initialDate) {
      setForm({
        work_date: initialDate,
        start_time: '09:00',
        end_time: '18:00',
        break_minutes: 60,
        work_type: 'normal',
        notes: '',
      })
    }
    setError(null)
  }, [record, initialDate, isOpen])

  if (!isOpen) return null

  const actualMinutes = calcActualMinutes(form.start_time, form.end_time, form.break_minutes)

  const handleChange = (field: keyof WorkEntryFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.start_time || !form.end_time) {
      setError('開始時刻と終了時刻を入力してください')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!window.confirm('この勤務記録を削除しますか？')) return
    setIsDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {record ? '勤務記録を編集' : '勤務記録を追加'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">日付</label>
            <p className="text-sm font-semibold text-gray-900">{formatDate(form.work_date)}</p>
          </div>

          {/* Work Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">勤務区分</label>
            <div className="flex flex-wrap gap-2">
              {workTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange('work_type', opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    form.work_type === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">開始時刻</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => handleChange('start_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">終了時刻</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => handleChange('end_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Break minutes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">休憩時間</label>
            <div className="flex flex-wrap gap-2">
              {breakOptions.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => handleChange('break_minutes', min)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    form.break_minutes === min
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {min === 0 ? 'なし' : `${min}分`}
                </button>
              ))}
            </div>
          </div>

          {/* Actual work time */}
          <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-blue-700 font-medium">実働時間</span>
            <span className="text-base font-bold text-blue-900">{formatMinutes(actualMinutes)}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">備考</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="任意メモ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <div>
            {record && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? '削除中...' : '削除'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkEntryModal
