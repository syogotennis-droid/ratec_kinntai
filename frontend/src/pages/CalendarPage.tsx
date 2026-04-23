import React, { useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, EventInput } from '@fullcalendar/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { workRecordsApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { WorkRecord } from '../types'
import WorkEntryModal from '../components/WorkEntryModal'
import type { WorkEntryFormData } from '../components/WorkEntryModal'

const workTypeColors: Record<string, string> = {
  normal: '#3b82f6',
  overtime: '#f97316',
  holiday: '#ef4444',
  training: '#22c55e',
  paid_leave: '#a855f7',
}

const workTypeLabels: Record<string, string> = {
  normal: '通常勤務',
  overtime: '残業',
  holiday: '休日出勤',
  training: '研修',
  paid_leave: '有給休暇',
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

const CalendarPage: React.FC = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentYearMonth, setCurrentYearMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null)
  const calendarRef = React.useRef<FullCalendar | null>(null)

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['calendar', user?.id, currentYearMonth],
    queryFn: () => workRecordsApi.calendar(user!.id, currentYearMonth).then((r) => r.data),
    enabled: !!user,
  })

  const { data: workRecords } = useQuery({
    queryKey: ['work-records', user?.id, currentYearMonth],
    queryFn: () =>
      workRecordsApi.list({ user_id: user!.id, year_month: currentYearMonth }).then((r) => r.data),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => workRecordsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['work-records', user?.id] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => workRecordsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['work-records', user?.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workRecordsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['work-records', user?.id] })
    },
  })

  const events: EventInput[] = React.useMemo(() => {
    if (!workRecords) return []
    return (workRecords as WorkRecord[]).map((r) => ({
      id: String(r.id),
      title: `${r.start_time}〜${r.end_time} ${workTypeLabels[r.work_type] ?? r.work_type}`,
      date: r.work_date,
      backgroundColor: workTypeColors[r.work_type] ?? '#6b7280',
      borderColor: workTypeColors[r.work_type] ?? '#6b7280',
      textColor: '#ffffff',
      extendedProps: { record: r },
    }))
  }, [workRecords])

  const totalMinutes = React.useMemo(() => {
    if (!workRecords) return 0
    return (workRecords as WorkRecord[]).reduce((acc, r) => acc + (r.actual_minutes ?? 0), 0)
  }, [workRecords])

  const handleDateClick = useCallback((arg: DateClickArg) => {
    setSelectedDate(arg.dateStr)
    setSelectedRecord(null)
    setModalOpen(true)
  }, [])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const record = arg.event.extendedProps.record as WorkRecord
    setSelectedRecord(record)
    setSelectedDate(record.work_date)
    setModalOpen(true)
  }, [])

  const handleDatesSet = (info: { startStr: string }) => {
    const d = new Date(info.startStr)
    d.setDate(d.getDate() + 7)
    const ym = format(d, 'yyyy-MM')
    setCurrentYearMonth(ym)
  }

  const handleSave = async (formData: WorkEntryFormData) => {
    if (selectedRecord) {
      await updateMutation.mutateAsync({ id: selectedRecord.id, data: { ...formData, user_id: user!.id } })
    } else {
      await createMutation.mutateAsync({ ...formData, user_id: user!.id })
    }
  }

  const handleDelete = async () => {
    if (selectedRecord) {
      await deleteMutation.mutateAsync(selectedRecord.id)
    }
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">勤務カレンダー</h1>
          {!isLoading && (
            <p className="text-sm text-gray-500">
              今月の総実働時間：<span className="font-semibold text-blue-600">{formatHours(totalMinutes)}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {Object.entries(workTypeColors).map(([type, color]) => (
            <div key={type} className="hidden sm:flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-600">{workTypeLabels[type]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend for mobile */}
      <div className="flex flex-wrap gap-2 sm:hidden mb-3">
        {Object.entries(workTypeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600">{workTypeLabels[type]}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <style>{`
          .fc-toolbar-title { font-size: 1rem !important; font-weight: 700 !important; }
          .fc-button { font-size: 0.8rem !important; padding: 0.3rem 0.75rem !important; }
          .fc-daygrid-event { cursor: pointer; }
          .fc-day-today { background-color: #eff6ff !important; }
          @media (max-width: 640px) {
            .fc-toolbar { flex-direction: column !important; gap: 0.5rem !important; }
          }
        `}</style>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="ja"
          firstDay={1}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          buttonText={{ today: '今日' }}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="100%"
          eventDisplay="block"
          dayMaxEvents={3}
        />
      </div>

      {/* Modal */}
      <WorkEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={selectedRecord ? handleDelete : undefined}
        initialDate={selectedDate}
        record={selectedRecord}
      />
    </div>
  )
}

export default CalendarPage
