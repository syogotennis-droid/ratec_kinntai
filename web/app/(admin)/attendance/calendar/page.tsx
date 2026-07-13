'use client'

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventInput } from '@fullcalendar/core'
import { createClient } from '@/lib/supabase/client'
import { WorkRecord } from '@/lib/supabase/types'
import WorkRecordModal from '@/components/WorkRecordModal'

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

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editRecord, setEditRecord] = useState<WorkRecord | null>(null)
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchRecords = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    const [year, month] = currentYearMonth.split('-').map(Number)
    const start = `${currentYearMonth}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${currentYearMonth}-${String(lastDay).padStart(2, '0')}`
    const { data } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date')
    setRecords(data ?? [])
  }, [userId, currentYearMonth])

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
    setCurrentYearMonth(ym)
  }

  if (!userId) return <div className="p-6 text-sm text-gray-500">読み込み中...</div>

  return (
    <div className="p-4">
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
