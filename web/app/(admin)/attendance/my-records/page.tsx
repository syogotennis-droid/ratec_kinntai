'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkRecord } from '@/lib/supabase/types'
import WorkRecordModal from '@/components/WorkRecordModal'

const WORK_TYPE_LABELS: Record<string, string> = {
  normal: '通常',
  overtime: '残業',
  holiday: '休日',
  training: '研修',
  paid_leave: '有給',
}

const WORK_TYPE_COLORS: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-700',
  overtime: 'bg-orange-100 text-orange-700',
  holiday: 'bg-red-100 text-red-700',
  training: 'bg-green-100 text-green-700',
  paid_leave: 'bg-purple-100 text-purple-700',
}

export default function MyRecordsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editRecord, setEditRecord] = useState<WorkRecord | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (data.session) setUserId(data.session.user.id)
    })
  }, [])

  const fetchRecords = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .gte('work_date', `${yearMonth}-01`)
      .lte('work_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('work_date', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [userId, yearMonth])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const totalMinutes = records.reduce((s, r) => s + (r.actual_minutes ?? 0), 0)

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
            合計 {Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ''}
            （{records.length}件）
          </span>
          <button
            onClick={() => setShowAdd(true)}
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
          {records.map(r => {
            const actualMin = r.actual_minutes ?? 0
            return (
              <div
                key={r.id}
                onClick={() => setEditRecord(r)}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="w-16 text-xs text-gray-500 shrink-0">
                  {r.work_date.slice(5).replace('-', '/')}
                </div>
                <div className="flex-1 text-sm text-gray-900">
                  {r.start_time}〜{r.end_time}
                </div>
                <div className="text-xs text-gray-600 shrink-0">
                  {Math.floor(actualMin / 60)}h{actualMin % 60 > 0 ? `${actualMin % 60}m` : ''}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${WORK_TYPE_COLORS[r.work_type] ?? 'bg-gray-100 text-gray-700'}`}>
                  {WORK_TYPE_LABELS[r.work_type] ?? r.work_type}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {(showAdd || editRecord) && (
        <WorkRecordModal
          userId={userId}
          record={editRecord}
          onClose={() => { setShowAdd(false); setEditRecord(null) }}
          onSaved={fetchRecords}
        />
      )}
    </div>
  )
}
