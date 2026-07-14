'use client'

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventInput } from '@fullcalendar/core'
import { createClient } from '@/lib/supabase/client'
import { Profile, WorkRecord, MonthlyClosing } from '@/lib/supabase/types'
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

const WORK_TYPE_BADGE: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-700',
  overtime: 'bg-orange-100 text-orange-700',
  holiday: 'bg-red-100 text-red-700',
  training: 'bg-green-100 text-green-700',
  paid_leave: 'bg-purple-100 text-purple-700',
}

interface EmployeeSummary {
  profile: Profile
  totalMinutes: number
  workDays: number
  isClosed: boolean
}

function getYearMonth(offset = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminWorkListPage() {
  const [yearMonth, setYearMonth] = useState(() => getYearMonth(0))
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const fetchSummaries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const start = `${yearMonth}-01`
    const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    const [profilesRes, recordsRes, closingsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
      supabase.from('work_records').select('user_id,actual_minutes,work_date').gte('work_date', start).lte('work_date', end),
      supabase.from('monthly_closings').select('*').eq('year_month', yearMonth),
    ])

    const profiles = profilesRes.data ?? []
    const records = recordsRes.data ?? []
    const closings = closingsRes.data ?? []

    const result: EmployeeSummary[] = profiles.map(profile => {
      const userRecords = records.filter(r => r.user_id === profile.id)
      const totalMinutes = userRecords.reduce((s, r) => s + (r.actual_minutes ?? 0), 0)
      const workDays = new Set(userRecords.map(r => r.work_date)).size
      const isClosed = closings.some(c => c.user_id === profile.id && c.status === 'closed')
      return { profile, totalMinutes, workDays, isClosed }
    })
    setSummaries(result)
    setLoading(false)
  }, [yearMonth])

  useEffect(() => { fetchSummaries() }, [fetchSummaries])

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

  if (selectedUserId) {
    const s = summaries.find(x => x.profile.id === selectedUserId)
    return (
      <EmployeeDetail
        profile={s!.profile}
        yearMonth={yearMonth}
        isClosed={s!.isClosed}
        onBack={() => { setSelectedUserId(null); fetchSummaries() }}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
          <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600 text-xs">氏名</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">出勤日数</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">勤務時間</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600 text-xs">締め</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => {
                const h = Math.floor(s.totalMinutes / 60)
                const m = s.totalMinutes % 60
                return (
                  <tr
                    key={s.profile.id}
                    onClick={() => setSelectedUserId(s.profile.id)}
                    className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <p className="font-medium text-gray-900">{s.profile.name}</p>
                      <p className="text-xs text-gray-400">{s.profile.employee_id}</p>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">{s.workDays}日</td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      {h}h{m > 0 ? `${m}m` : ''}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.isClosed ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.isClosed ? '締済' : '未締'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface EmployeeDetailProps {
  profile: Profile
  yearMonth: string
  isClosed: boolean
  onBack: () => void
}

function EmployeeDetail({ profile, yearMonth, isClosed: initialClosed, onBack }: EmployeeDetailProps) {
  const [tab, setTab] = useState<'calendar' | 'list'>('calendar')
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isClosed, setIsClosed] = useState(initialClosed)
  const [togglingClose, setTogglingClose] = useState(false)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editRecord, setEditRecord] = useState<WorkRecord | null>(null)
  const [detailYearMonth, setDetailYearMonth] = useState(yearMonth)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = detailYearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', profile.id)
      .gte('work_date', `${detailYearMonth}-01`)
      .lte('work_date', `${detailYearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('work_date')
    setRecords(data ?? [])
    setLoading(false)
  }, [profile.id, detailYearMonth])

  const fetchClosing = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('monthly_closings')
      .select('status')
      .eq('user_id', profile.id)
      .eq('year_month', detailYearMonth)
      .single()
    setIsClosed(data?.status === 'closed')
  }, [profile.id, detailYearMonth])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { fetchClosing() }, [fetchClosing])

  const handleToggleClose = async () => {
    setTogglingClose(true)
    const supabase = createClient()
    const newStatus = isClosed ? 'open' : 'closed'
    const { data: existing } = await supabase
      .from('monthly_closings')
      .select('id')
      .eq('user_id', profile.id)
      .eq('year_month', detailYearMonth)
      .single()

    if (existing) {
      await supabase.from('monthly_closings').update({
        status: newStatus,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
      }).eq('id', existing.id)
    } else {
      await supabase.from('monthly_closings').insert({
        user_id: profile.id,
        year_month: detailYearMonth,
        status: newStatus,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
      })
    }
    setIsClosed(newStatus === 'closed')
    setTogglingClose(false)
  }

  const prevMonth = () => {
    const [y, m] = detailYearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setDetailYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = detailYearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setDetailYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const totalMinutes = records.reduce((s, r) => s + (r.actual_minutes ?? 0), 0)
  const workDays = new Set(records.map(r => r.work_date)).size

  const events: EventInput[] = records.map(r => ({
    id: String(r.id),
    title: `${r.start_time}〜${r.end_time} ${WORK_TYPE_LABELS[r.work_type] ?? ''}`,
    date: r.work_date,
    backgroundColor: WORK_TYPE_COLORS[r.work_type] ?? '#6b7280',
    borderColor: 'transparent',
    extendedProps: { record: r },
  }))

  const handleDatesSet = (info: { startStr: string }) => {
    const d = new Date(info.startStr)
    d.setDate(d.getDate() + 14)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setDetailYearMonth(ym)
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          ← 一覧
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-900">{profile.name}</h2>
          <p className="text-xs text-gray-400">{profile.employee_id}</p>
        </div>
        <button
          onClick={handleToggleClose}
          disabled={togglingClose}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isClosed
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              : 'bg-red-100 hover:bg-red-200 text-red-700'
          }`}
        >
          {isClosed ? '締め解除' : '締める'}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
        <span className="text-sm font-bold text-gray-900">{detailYearMonth.replace('-', '年')}月</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">
          {workDays}日・{Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ''}
        </span>
        {isClosed && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">締済</span>
        )}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['calendar', 'list'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {t === 'calendar' ? 'カレンダー' : 'リスト'}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div>
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
            initialDate={`${detailYearMonth}-01`}
            locale="ja"
            events={events}
            dateClick={(arg: DateClickArg) => { if (!isClosed) { setEditRecord(null); setModalDate(arg.dateStr) } }}
            eventClick={(arg: EventClickArg) => { if (!isClosed) { setEditRecord(arg.event.extendedProps.record as WorkRecord); setModalDate(null) } }}
            datesSet={handleDatesSet}
            height="auto"
            buttonText={{ today: '今日', month: '月' }}
          />
        </div>
      )}

      {tab === 'list' && (
        <div>
          <div className="flex justify-end mb-3">
            {!isClosed && (
              <button
                onClick={() => { setEditRecord(null); setModalDate(new Date().toLocaleDateString('sv-SE')) }}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                + 追加
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">記録がありません</div>
          ) : (
            <div className="space-y-2">
              {[...records].reverse().map(r => {
                const am = r.actual_minutes ?? 0
                return (
                  <div
                    key={r.id}
                    onClick={() => { if (!isClosed) { setEditRecord(r); setModalDate(null) } }}
                    className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg transition-colors ${
                      isClosed ? 'opacity-70' : 'hover:bg-blue-50 cursor-pointer'
                    }`}
                  >
                    <div className="w-16 text-xs text-gray-500 shrink-0">{r.work_date.slice(5).replace('-', '/')}</div>
                    <div className="flex-1 text-sm text-gray-900">{r.start_time}〜{r.end_time}</div>
                    <div className="text-xs text-gray-600 shrink-0">{Math.floor(am / 60)}h{am % 60 > 0 ? `${am % 60}m` : ''}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${WORK_TYPE_BADGE[r.work_type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {WORK_TYPE_LABELS[r.work_type] ?? r.work_type}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {(modalDate !== null || editRecord !== null) && !isClosed && (
        <WorkRecordModal
          userId={profile.id}
          date={modalDate ?? undefined}
          record={editRecord}
          onClose={() => { setModalDate(null); setEditRecord(null) }}
          onSaved={fetchRecords}
        />
      )}
    </div>
  )
}
