'use client'

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventInput } from '@fullcalendar/core'
import { createClient } from '@/lib/supabase/client'
import { WorkRecord } from '@/lib/supabase/types'
import WorkRecordModal from '@/components/WorkRecordModal'
import { useProfile } from '@/lib/profile-context'

const WORK_TYPE_COLORS: Record<string, string> = {
  normal: '#3b82f6',
  overtime: '#f97316',
  holiday: '#ef4444',
  training: '#22c55e',
  paid_leave: '#a855f7',
}

const WORK_TYPE_LABELS: Record<string, string> = {
  normal: '通常',
  overtime: '残業',
  holiday: '休日',
  training: '研修',
  paid_leave: '有給',
}

const WORK_TYPE_BADGE: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-700',
  overtime: 'bg-orange-100 text-orange-700',
  holiday: 'bg-red-100 text-red-700',
  training: 'bg-green-100 text-green-700',
  paid_leave: 'bg-purple-100 text-purple-700',
}

export default function WorkPage() {
  const profile = useProfile()
  const userId = profile.id
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editRecord, setEditRecord] = useState<WorkRecord | null>(null)
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchRecords = useCallback(async () => {
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
  }, [userId, yearMonth])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const events: EventInput[] = records.map(r => ({
    id: String(r.id),
    title: `${r.start_time}〜${r.end_time} ${WORK_TYPE_LABELS[r.work_type] ?? r.work_type}`,
    date: r.work_date,
    backgroundColor: WORK_TYPE_COLORS[r.work_type] ?? '#6b7280',
    borderColor: 'transparent',
    extendedProps: { record: r },
  }))

  const handleDateClick = (arg: DateClickArg) => {
    setEditRecord(null)
    setModalDate(arg.dateStr)
  }

  const handleEventClick = (arg: EventClickArg) => {
    setEditRecord(arg.event.extendedProps.record as WorkRecord)
    setModalDate(null)
  }

  const handleDatesSet = (info: { startStr: string }) => {
    const d = new Date(info.startStr)
    d.setDate(d.getDate() + 14)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setYearMonth(ym)
  }

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

  const totalMinutes = records.reduce((s, r) => s + (r.actual_minutes ?? 0), 0)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 transition-colors ${view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            📅 カレンダー
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            📋 リスト
          </button>
        </div>
        <button
          onClick={() => { setEditRecord(null); setModalDate(new Date().toLocaleDateString('sv-SE')) }}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          + 追加
        </button>
      </div>

      {view === 'calendar' ? (
        <>
          <style>{`
            .fc-daygrid-day { cursor: pointer; transition: background-color 0.1s; }
            .fc-daygrid-day:hover { background-color: #dbeafe !important; }
            .fc-daygrid-day:active { background-color: #bfdbfe !important; }
            .fc-daygrid-day-number { pointer-events: none; }
            .fc-event { cursor: pointer; font-size: 11px; padding: 1px 4px; border-radius: 4px; }
            .fc-toolbar-title { font-size: 1rem !important; font-weight: 700; }
            .fc-button { font-size: 0.75rem !important; padding: 4px 10px !important; }
          `}</style>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ja"
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            height="auto"
            buttonText={{ today: '今日', month: '月', week: '週' }}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">‹</button>
              <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">›</button>
            </div>
            <span className="text-xs text-gray-500">
              合計 {Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ''}（{records.length}件）
            </span>
          </div>
          {records.length === 0 ? (
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${WORK_TYPE_BADGE[r.work_type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {WORK_TYPE_LABELS[r.work_type] ?? r.work_type}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {(modalDate !== null || editRecord !== null) && (
        <WorkRecordModal
          userId={userId}
          date={modalDate ?? undefined}
          record={editRecord}
          onClose={() => { setModalDate(null); setEditRecord(null) }}
          onSaved={fetchRecords}
        />
      )}
    </div>
  )
}
