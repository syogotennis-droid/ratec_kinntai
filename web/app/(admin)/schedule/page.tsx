'use client'

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventInput } from '@fullcalendar/core'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/profile-context'

interface Schedule {
  id: number
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  notes: string | null
  created_by: string | null
  creator_name: string | null
  created_at: string
}

export default function SchedulePage() {
  const profile = useProfile()
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await createClient()
      .from('schedules')
      .select('*, profiles(name)')
      .gte('date', `${yearMonth}-01`)
      .lte('date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('date')
      .order('start_time')
    setSchedules(
      (data ?? []).map((s: { profiles?: { name: string } | null; [key: string]: unknown }) => ({
        ...s,
        creator_name: (s.profiles as { name: string } | null)?.name ?? null,
      })) as Schedule[]
    )
    setLoading(false)
  }, [yearMonth])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const handleDatesSet = (info: { startStr: string }) => {
    const d = new Date(info.startStr)
    d.setDate(d.getDate() + 14)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const openAdd = (date?: string) => {
    setEditSchedule(null)
    setDefaultDate(date)
    setShowModal(true)
  }

  const openEdit = (s: Schedule) => {
    setEditSchedule(s)
    setDefaultDate(undefined)
    setShowModal(true)
  }

  const handleDateClick = (arg: DateClickArg) => openAdd(arg.dateStr)
  const handleEventClick = (arg: EventClickArg) => openEdit(arg.event.extendedProps.schedule as Schedule)

  const events: EventInput[] = schedules.map(s => ({
    id: String(s.id),
    title: s.start_time ? `${s.start_time.slice(0, 5)} ${s.title}` : s.title,
    date: s.date,
    backgroundColor: '#3b82f6',
    borderColor: 'transparent',
    extendedProps: { schedule: s },
  }))

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

  const grouped = schedules.reduce<Record<string, Schedule[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})

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
          onClick={() => openAdd(new Date().toISOString().slice(0, 10))}
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
        <div className="max-w-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">‹</button>
              <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">›</button>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">予定がありません</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, items]) => {
                const [, m, d] = date.split('-')
                const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()]
                const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6
                return (
                  <div key={date}>
                    <p className={`text-xs font-bold mb-1.5 ${isWeekend ? 'text-red-500' : 'text-gray-500'}`}>
                      {m}/{d}（{dayOfWeek}）
                    </p>
                    <div className="space-y-1.5">
                      {items.map(s => (
                        <div
                          key={s.id}
                          onClick={() => openEdit(s)}
                          className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          {s.start_time && (
                            <span className="text-xs text-gray-400 shrink-0 pt-0.5">
                              {s.start_time.slice(0, 5)}{s.end_time ? `〜${s.end_time.slice(0, 5)}` : ''}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{s.title}</p>
                            {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                          </div>
                          {s.creator_name && (
                            <span className="text-xs text-gray-400 shrink-0">{s.creator_name}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ScheduleModal
          schedule={editSchedule}
          defaultDate={defaultDate}
          userId={profile.id}
          onClose={() => { setShowModal(false); setEditSchedule(null) }}
          onSaved={fetchSchedules}
        />
      )}
    </div>
  )
}

interface ScheduleModalProps {
  schedule: Schedule | null
  defaultDate?: string
  userId: string
  onClose: () => void
  onSaved: () => void
}

function ScheduleModal({ schedule, defaultDate, userId, onClose, onSaved }: ScheduleModalProps) {
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [date, setDate] = useState(schedule?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(schedule?.end_time?.slice(0, 5) ?? '')
  const [notes, setNotes] = useState(schedule?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!title || !date) return
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        title,
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        notes: notes || null,
        created_by: userId,
      }
      if (schedule) {
        await supabase.from('schedules').update(payload).eq('id', schedule.id)
      } else {
        await supabase.from('schedules').insert(payload)
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
    if (!schedule || !confirm('削除しますか？')) return
    setSaving(true)
    await createClient().from('schedules').delete().eq('id', schedule.id)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">{schedule ? '予定を編集' : '予定を追加'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">タイトル *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付 *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">開始時刻</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">終了時刻</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          {schedule && (
            <button onClick={handleDelete} disabled={saving} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !title || !date}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
