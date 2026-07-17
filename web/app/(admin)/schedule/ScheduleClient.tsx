'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/profile-context'
import { useSidebar } from '@/lib/sidebar-context'
import holidayJp from '@holiday-jp/holiday_jp'

interface CalEvent {
  title: string
  date: string
  backgroundColor: string
  textColor: string
  isHoliday?: boolean
}

export interface Schedule {
  id: number
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  name: string
  avatar_char: string | null
  color: string | null
}

export type WorkType = 'normal' | 'paid_leave' | 'hourly_leave'

export interface WorkRecord {
  id: number
  user_id: string
  work_date: string
  start_time: string
  end_time: string
  break_minutes: number
  work_type: WorkType
  notes: string | null
}

const WORK_TYPE_COLOR: Record<WorkType, string> = {
  normal: '#16a34a',
  paid_leave: '#9333ea',
  hourly_leave: '#0891b2',
}
const WORK_TYPE_LABEL: Record<WorkType, string> = {
  normal: '通常',
  paid_leave: '有休',
  hourly_leave: '時間休',
}
const OVERTIME_COLOR = '#ea580c'
// セル内の勤怠カード用：薄い背景＋濃い文字で可読性を優先した配色（色の意味＝どの勤務区分かは既存のまま）
const WORK_TYPE_LIGHT: Record<'normal' | 'overtime' | WorkType, { bg: string; fg: string; border: string }> = {
  normal: { bg: '#bbf7d0', fg: '#15803d', border: '#16a34a' },
  overtime: { bg: '#fed7aa', fg: '#c2410c', border: OVERTIME_COLOR },
  paid_leave: { bg: '#e9d5ff', fg: '#7e22ce', border: '#9333ea' },
  hourly_leave: { bg: '#a5f3fc', fg: '#0e7490', border: '#0891b2' },
}
const LEGEND_ITEMS: Array<{ key: 'normal' | 'overtime' | WorkType; label: string }> = [
  { key: 'normal', label: '通常' },
  { key: 'overtime', label: '残業' },
  { key: 'paid_leave', label: '有休' },
  { key: 'hourly_leave', label: '時間休' },
]

// 従業員ごとの色（profile.colorが未設定な場合のフォールバック）。
// 隣り合う従業員が似た色にならないよう、赤系（祝日カラーと混同するため除外）を避けつつ色相を大きく離して並べている。
const USER_COLORS = [
  '#2563eb', // 青
  '#ea580c', // オレンジ
  '#16a34a', // 緑
  '#7c3aed', // 紫
  '#0891b2', // シアン
  '#65a30d', // 黄緑
  '#c026d3', // マゼンタ
  '#0d9488', // 深緑・ティール
]

function userColor(userId: string | null) {
  if (!userId) return USER_COLORS[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return USER_COLORS[hash % USER_COLORS.length]
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 予定カード用の表示名：色だけに頼らず従業員が分かるよう、既存の氏名から姓のみを取り出す（新しい表示名データは追加しない）
function familyName(fullName: string) {
  const idx = fullName.indexOf(' ')
  return idx === -1 ? fullName : fullName.slice(0, idx)
}


function actualMinutes(start: string, end: string, breakMin: number): number {
  const [sh, sm] = start.slice(0, 5).split(':').map(Number)
  const [eh, em] = end.slice(0, 5).split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm) - breakMin
}

function formatTime(t: string | null) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? '午前' : '午後'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${ampm}${hour}:${String(m).padStart(2, '0')}`
}

export default function ScheduleClient({ initialYearMonth, initialSchedules, initialWorkRecords, initialProfiles }: {
  initialYearMonth: string
  initialSchedules: Schedule[]
  initialWorkRecords: WorkRecord[]
  initialProfiles: UserProfile[]
}) {
  const profile = useProfile()
  const openSidebar = useSidebar()
  const [view, setView] = useState<'schedule' | 'attendance'>(profile.is_admin ? 'schedule' : 'attendance')
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [profiles] = useState<UserProfile[]>(initialProfiles)
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>(initialWorkRecords)
  const [loading, setLoading] = useState(false)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [workDaySheetDate, setWorkDaySheetDate] = useState<string | null>(null)
  const [selectedWorkDate, setSelectedWorkDate] = useState<string | null>(null)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [editWorkRecord, setEditWorkRecord] = useState<WorkRecord | null>(null)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [addWorkDate, setAddWorkDate] = useState<string | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [visibleUserIds, setVisibleUserIds] = useState<Set<string> | null>(null)
  const touchStartX = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [sliding, setSliding] = useState(false)
  const [yearMonth, setYearMonth] = useState(initialYearMonth)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await createClient()
      .from('schedules')
      .select('*')
      .gte('date', `${yearMonth}-01`)
      .lte('date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('date')
      .order('start_time')
    setSchedules(data ?? [])
    setLoading(false)
  }, [yearMonth])

  const schedulesDidMount = useRef(false)
  useEffect(() => {
    if (!schedulesDidMount.current) { schedulesDidMount.current = true; return }
    fetchSchedules()
  }, [fetchSchedules])

  const fetchWorkRecords = useCallback(async () => {
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await createClient()
      .from('work_records')
      .select('*')
      .eq('user_id', profile.id)
      .gte('work_date', `${yearMonth}-01`)
      .lte('work_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
    setWorkRecords(data ?? [])
  }, [yearMonth, profile.id])

  const workRecordsDidMount = useRef(false)
  useEffect(() => {
    if (!workRecordsDidMount.current) { workRecordsDidMount.current = true; return }
    fetchWorkRecords()
  }, [fetchWorkRecords])

  const displayYear = Number(yearMonth.split('-')[0])
  const displayMonth = Number(yearMonth.split('-')[1])

  const goNext = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const goPrev = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const goToMonth = (y: number, m: number) => {
    setYearMonth(`${y}-${String(m).padStart(2, '0')}`)
    setShowMonthPicker(false)
  }
  const goToday = () => {
    const d = new Date()
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const toggleUser = (id: string) => {
    setVisibleUserIds(prev => {
      const base = prev ?? new Set(profiles.map(p => p.id))
      const next = new Set(base)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (sliding) return
    setDragX(e.touches[0].clientX - touchStartX.current)
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (sliding) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    const W = window.innerWidth
    if (Math.abs(diff) > 60) {
      const dir = diff > 0 ? 1 : -1
      setSliding(true)
      setDragX(-dir * W)
      setTimeout(() => {
        dir > 0 ? goNext() : goPrev()
        setDragX(dir * W)
        setTimeout(() => {
          setDragX(0)
          setSliding(false)
        }, 30)
      }, 220)
    } else {
      setSliding(true)
      setDragX(0)
      setTimeout(() => setSliding(false), 220)
    }
  }

  const holidayEvents: CalEvent[] = (() => {
    const start = new Date(Number(yearMonth.split('-')[0]) - 1, 0, 1)
    const end = new Date(Number(yearMonth.split('-')[0]) + 1, 11, 31)
    return holidayJp.between(start, end).map((h: { date: Date; name: string }) => {
      const d = h.date
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { title: h.name, date, backgroundColor: '#ef4444', textColor: '#ffffff', isHoliday: true }
    })
  })()

  const holidayDates = new Set(holidayEvents.map(e => e.date))

  const visibleSchedules = useMemo(() => {
    if (!visibleUserIds) return schedules
    return schedules.filter(s => s.created_by && visibleUserIds.has(s.created_by))
  }, [schedules, visibleUserIds])

  interface ScheduleChip {
    schedule: Schedule
    employeeName: string
    initial: string
    color: string
    timeStr: string | null
  }

  const scheduleChips: ScheduleChip[] = useMemo(() => visibleSchedules.map(s => {
    const p = profiles.find(pr => pr.id === s.created_by)
    const color = p?.color || userColor(s.created_by)
    const employeeName = p?.name || '不明'
    const initial = p?.avatar_char || p?.name?.charAt(0) || '?'
    const timeStr = s.start_time ? `${s.start_time.slice(0, 5)}${s.end_time ? '–' + s.end_time.slice(0, 5) : ''}` : null
    return { schedule: s, employeeName, initial, color, timeStr }
  }), [visibleSchedules, profiles])

  const scheduleChipsByDate = useMemo(() => {
    return scheduleChips.reduce<Record<string, ScheduleChip[]>>((acc, c) => {
      if (!acc[c.schedule.date]) acc[c.schedule.date] = []
      acc[c.schedule.date].push(c)
      return acc
    }, {})
  }, [scheduleChips])

  const numWeeks = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    return Math.ceil((firstDay + daysInMonth) / 7)
  }, [yearMonth])

  const calendarDays = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    const totalCells = numWeeks * 7
    const days: Array<{ date: string; dayNum: number; isCurrentMonth: boolean }> = []
    const prevDays = new Date(y, m - 1, 0).getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
      const pd = new Date(y, m - 2, 1)
      const d = prevDays - i
      days.push({ date: `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, dayNum: d, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, dayNum: d, isCurrentMonth: true })
    }
    const nd = new Date(y, m, 1)
    let ndd = 1
    while (days.length < totalCells) {
      days.push({ date: `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2,'0')}-${String(ndd).padStart(2,'0')}`, dayNum: ndd++, isCurrentMonth: false })
    }
    return days
  }, [yearMonth, numWeeks])

  const eventsByDate = useMemo(() => {
    return holidayEvents.reduce<Record<string, CalEvent[]>>((acc, e) => {
      if (!acc[e.date]) acc[e.date] = []
      acc[e.date].push(e)
      return acc
    }, {})
  }, [holidayEvents])

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }, [])

  // FABの新規追加は、表示中の月に「今日」が含まれる場合は今日、それ以外はその月の1日を初期値にする
  const fabDefaultDate = todayStr.slice(0, 7) === yearMonth ? todayStr : `${yearMonth}-01`

  const workRecordsByDate = useMemo(() => {
    return workRecords.reduce<Record<string, WorkRecord>>((acc, r) => {
      acc[r.work_date] = r
      return acc
    }, {})
  }, [workRecords])

  const daySchedules = daySheet ? (schedules.filter(s => s.date === daySheet)) : []

  const viewToggle = (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
      <button onClick={() => setView('attendance')}
        className={`px-3 py-1.5 transition-colors ${view === 'attendance' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
        勤怠
      </button>
      <button onClick={() => setView('schedule')}
        className={`px-3 py-1.5 transition-colors ${view === 'schedule' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
        予定
      </button>
    </div>
  )

  const header = (
    <div className="px-1 mb-0.5 shrink-0">
      <div className="flex flex-wrap items-center gap-1" style={{ minHeight: 28 }}>
        <button onClick={openSidebar} className="p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-gray-900 mr-1 hidden sm:block">勤怠・予定</h1>
        <button onClick={goPrev} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-base leading-none">‹</button>
        <button onClick={() => setShowMonthPicker(true)}
          className="text-sm font-bold text-gray-900 px-1.5 py-1 rounded-lg hover:bg-gray-100">
          {displayYear}年{displayMonth}月
        </button>
        <button onClick={goNext} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-base leading-none">›</button>
        <button onClick={goToday} className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">今日</button>
        {!profile.is_admin && <div className="ml-auto">{viewToggle}</div>}
      </div>
      {view === 'attendance' && (
        <div className="flex items-center gap-2.5 flex-wrap px-1 mt-0.5">
          {LEGEND_ITEMS.map(item => (
            <span key={item.key} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: WORK_TYPE_LIGHT[item.key].bg, border: `1px solid ${WORK_TYPE_LIGHT[item.key].border}` }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
      {view === 'schedule' && (
        <div className="flex items-center gap-2 px-1 mt-1.5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <span className="shrink-0 text-[9px] font-medium text-gray-400">表示対象</span>
          <button onClick={() => setVisibleUserIds(null)}
            className="shrink-0 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors whitespace-nowrap"
            style={visibleUserIds === null
              ? { backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb' }
              : { backgroundColor: '#fff', color: '#374151', borderColor: '#d1d5db' }}>
            全員
          </button>
          <button onClick={() => setVisibleUserIds(new Set([profile.id]))}
            className="shrink-0 text-[10px] px-2 py-1 rounded-full border font-medium transition-colors whitespace-nowrap"
            style={visibleUserIds?.size === 1 && visibleUserIds.has(profile.id)
              ? { backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb' }
              : { backgroundColor: '#fff', color: '#374151', borderColor: '#d1d5db' }}>
            自分のみ
          </button>
          <span className="shrink-0 w-px h-4 bg-gray-300 mx-1.5" />
          <span className="shrink-0 text-[9px] font-medium text-gray-400">担当者</span>
          {profiles.map(p => {
            const isVisible = visibleUserIds === null || visibleUserIds.has(p.id)
            const color = p.color || userColor(p.id)
            return (
              <button key={p.id} onClick={() => toggleUser(p.id)}
                className="shrink-0 inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: isVisible ? hexToRgba(color, 0.16) : '#ffffff',
                  borderColor: isVisible ? color : '#d1d5db',
                  color: isVisible ? color : '#374151',
                  fontWeight: isVisible ? 700 : 500,
                }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {isVisible && <span style={{ fontSize: 9 }}>✓</span>}
                {p.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col pt-1 pb-0 md:h-screen md:overflow-hidden">
      <style>{`
        .drum-col { scrollbar-width: none; -ms-overflow-style: none; }
        .drum-col::-webkit-scrollbar { display: none; }
        .cal-cell { position: relative; }
        .cal-cell .cal-hint { opacity: 0; transition: opacity 120ms; }
        .cal-cell:hover .cal-hint { opacity: 1; }
        .cal-cell:hover { background-color: #f9fafb; }
        .cal-chip:hover { filter: brightness(0.97); }
        .cal-more:hover { text-decoration: underline; color: #2563eb !important; }
      `}</style>
      {header}

      {view === 'schedule' ? (
        <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden">
          {/* Swipe wrapper */}
          <div className="md:flex-1 md:min-h-0 flex flex-col" style={{ overflow: 'hidden' }}>
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="md:flex-1 md:min-h-0 flex flex-col"
              style={{ transform: `translateX(${dragX}px)`, transition: sliding ? 'transform 220ms ease-out' : 'none', willChange: 'transform' }}
            >
              {/* Calendar grid: PC/タブレット */}
              <div className="hidden md:flex md:flex-1 md:min-h-0" style={{ flexDirection: 'column' }}>
                {/* Day-of-week header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #9ca3af' }}>
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', padding: '2px 0', fontSize: 11, fontWeight: 600, color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numWeeks}, 1fr)` }}>
                  {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
                    const dayEvts = eventsByDate[date] ?? []
                    const dayChips = scheduleChipsByDate[date] ?? []
                    const isToday = date === todayStr
                    const isHoliday = holidayDates.has(date)
                    const dow = new Date(`${date}T00:00:00`).getDay()
                    const maxPerCell = 3
                    const shownChips = dayChips.slice(0, maxPerCell)
                    const extra = dayChips.length - maxPerCell
                    const numColor = isHoliday || dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : ''
                    const handleCellClick = () => {
                      if (!isCurrentMonth) return
                      if (dayChips.length === 0) { setAddDate(date) } else { setDaySheet(date) }
                    }
                    return (
                      <div
                        key={date}
                        className="cal-cell"
                        onClick={handleCellClick}
                        style={{
                          borderRight: '1px solid #d1d5db',
                          borderBottom: '1px solid #d1d5db',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: isToday ? '#eff6ff' : undefined,
                          opacity: isCurrentMonth ? 1 : 0.35,
                          padding: 2,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: isToday ? 9999 : 0,
                            backgroundColor: isToday ? '#2563eb' : 'transparent',
                            color: isToday ? '#ffffff' : (numColor || '#374151'),
                            fontSize: 14, fontWeight: isToday ? 700 : 600, lineHeight: 1,
                          }}>
                            {dayNum}
                          </span>
                          {isCurrentMonth && dayChips.length === 0 && (
                            <span className="cal-hint" style={{ fontSize: 13, color: '#9ca3af', paddingRight: 2 }}>＋</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', marginTop: 0 }}>
                          {dayEvts.map((e, i) => (
                            <div key={`h${i}`} style={{ backgroundColor: e.backgroundColor, color: e.textColor, fontSize: 10, fontWeight: 600, lineHeight: '15px', padding: '0 3px', borderRadius: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }} title={e.title}>
                              {e.title}
                            </div>
                          ))}
                          {shownChips.map(c => {
                            const displayName = c.employeeName === '不明' ? '不明' : familyName(c.employeeName)
                            const label = `${c.employeeName}${c.timeStr ? ' ' + c.timeStr : ''} / ${c.schedule.title}`
                            return (
                              <div key={c.schedule.id} className="cal-chip" title={label}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: hexToRgba(c.color, 0.26), borderLeft: `3px solid ${c.color}`, borderRadius: 4, padding: '2px 4px', lineHeight: '15px', overflow: 'hidden', flexShrink: 0 }}>
                                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#ffffff', backgroundColor: c.color, borderRadius: 999, padding: '1px 5px', lineHeight: '13px' }}>{displayName}</span>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: 500, color: '#1f2937', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.schedule.title}</span>
                                {c.timeStr && (
                                  <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 500, color: '#6b7280' }}>{c.timeStr}</span>
                                )}
                              </div>
                            )
                          })}
                          {extra > 0 && (
                            <div className="cal-more" style={{ fontSize: 10, color: '#6b7280', lineHeight: '14px', paddingLeft: 2, fontWeight: 500, flexShrink: 0, cursor: 'pointer' }}>ほか{extra}件</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* スマホ: 月間カレンダー */}
              <div className="md:hidden">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #9ca3af' }}>
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, fontWeight: 600, color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
                  const dayEvts = eventsByDate[date] ?? []
                  const dayChips = scheduleChipsByDate[date] ?? []
                  const isToday = date === todayStr
                  const isHoliday = holidayDates.has(date)
                  const dow = new Date(`${date}T00:00:00`).getDay()
                  const numColor = isHoliday || dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : ''
                  const maxPerCell = 2
                  const shownChips = dayChips.slice(0, maxPerCell)
                  const extra = dayChips.length - maxPerCell
                  const handleCellClick = () => {
                    if (!isCurrentMonth) return
                    if (dayChips.length === 0) { setAddDate(date) } else { setDaySheet(date) }
                  }
                  return (
                    <div key={date} className="cal-cell" onClick={handleCellClick}
                      style={{
                        borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                        minHeight: 62, overflow: 'hidden', cursor: 'pointer',
                        backgroundColor: isToday ? '#eff6ff' : undefined,
                        opacity: isCurrentMonth ? 1 : 0.35, padding: '2px 1px',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: isToday ? 9999 : 0,
                          backgroundColor: isToday ? '#2563eb' : 'transparent',
                          color: isToday ? '#ffffff' : (numColor || '#374151'),
                          fontSize: 12, fontWeight: isToday ? 700 : 600, lineHeight: 1,
                        }}>
                          {dayNum}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2, overflow: 'hidden' }}>
                        {dayEvts.slice(0, 1).map((e, i) => (
                          <div key={`h${i}`} style={{ backgroundColor: e.backgroundColor, color: e.textColor, fontSize: 8.5, fontWeight: 600, lineHeight: '12px', borderRadius: 2, padding: '0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={e.title}>
                            {e.title}
                          </div>
                        ))}
                        {shownChips.map(c => (
                          <div key={c.schedule.id} title={`${c.employeeName}${c.timeStr ? ' ' + c.timeStr : ''} / ${c.schedule.title}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: hexToRgba(c.color, 0.26), borderLeft: `2px solid ${c.color}`, borderRadius: 2, padding: '0 2px', lineHeight: '13px', overflow: 'hidden' }}>
                            <span style={{ flexShrink: 0, width: 11, height: 11, borderRadius: 999, backgroundColor: c.color, color: '#ffffff', fontSize: 7.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{c.initial}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 9, fontWeight: 500, color: '#1f2937', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.schedule.title}</span>
                          </div>
                        ))}
                        {extra > 0 && (
                          <div className="cal-more" style={{ fontSize: 8.5, color: '#6b7280', lineHeight: '11px', fontWeight: 600 }}>ほか{extra}件</div>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            </div>
          </div>
          {showMonthPicker && (
            <MonthPicker
              year={displayYear}
              month={displayMonth}
              onSelect={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden">
          {/* Attendance calendar grid */}
          <div className="md:flex-1 md:min-h-0 flex flex-col" style={{ overflow: 'hidden' }}>
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="md:flex-1 md:min-h-0 flex flex-col"
              style={{ transform: `translateX(${dragX}px)`, transition: sliding ? 'transform 220ms ease-out' : 'none', willChange: 'transform' }}
            >
              <div className="hidden md:flex md:flex-1 md:min-h-0" style={{ flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #9ca3af' }}>
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', padding: '2px 0', fontSize: 11, fontWeight: 600, color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
                  ))}
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numWeeks}, 1fr)` }}>
                  {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
                    const wr = workRecordsByDate[date]
                    const isToday = date === todayStr
                    const isHoliday = holidayDates.has(date)
                    const dow = new Date(`${date}T00:00:00`).getDay()
                    const numColor = isHoliday || dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : ''
                    const isSelected = selectedWorkDate === date
                    const handleWorkDateClick = () => {
                      if (!isCurrentMonth) return
                      if (isSelected) {
                        const existing = workRecordsByDate[date] ?? null
                        if (existing) { setEditWorkRecord(existing); setAddWorkDate(null) }
                        else { setAddWorkDate(date); setEditWorkRecord(null) }
                        setSelectedWorkDate(null)
                      } else {
                        setSelectedWorkDate(date)
                      }
                    }
                    const isOvertime = !!wr && wr.work_type === 'normal' && actualMinutes(wr.start_time, wr.end_time, wr.break_minutes) > 480
                    const chipLabel = wr ? (isOvertime ? '残業' : WORK_TYPE_LABEL[wr.work_type]) : ''
                    const chipStyle = wr ? WORK_TYPE_LIGHT[isOvertime ? 'overtime' : wr.work_type] : null
                    return (
                      <div
                        key={date}
                        className="cal-cell"
                        onClick={handleWorkDateClick}
                        style={{
                          borderRight: '1px solid #d1d5db',
                          borderBottom: '1px solid #d1d5db',
                          overflow: 'hidden',
                          cursor: isCurrentMonth ? 'pointer' : 'default',
                          backgroundColor: isSelected ? '#dbeafe' : isToday ? '#eff6ff' : undefined,
                          opacity: isCurrentMonth ? 1 : 0.35,
                          padding: 2,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 2px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: isToday ? 9999 : 0,
                            backgroundColor: isToday ? '#2563eb' : 'transparent',
                            color: isToday ? '#ffffff' : (numColor || '#374151'),
                            fontSize: 14, fontWeight: isToday ? 700 : 600, lineHeight: 1,
                          }}>
                            {dayNum}
                          </span>
                          {isCurrentMonth && !wr && (
                            <span className="cal-hint" style={{ fontSize: 13, color: '#9ca3af', paddingRight: 2 }}>＋</span>
                          )}
                        </div>
                        {wr && chipStyle && (
                          <div className="cal-chip" style={{ backgroundColor: chipStyle.bg, borderLeft: `4px solid ${chipStyle.border}`, borderRadius: 4, padding: '4px 6px', margin: '1px 1px 0' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: chipStyle.fg, lineHeight: '13px' }}>
                              {chipLabel}
                            </div>
                            {wr.work_type !== 'paid_leave' ? (
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: '19px', whiteSpace: 'nowrap' }}>
                                {wr.start_time.slice(0, 5)}–{wr.end_time.slice(0, 5)}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: '17px' }}>終日</div>
                            )}
                            {wr.notes && (
                              <div style={{ fontSize: 10.5, color: '#57606f', lineHeight: '13px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 1 }} title={wr.notes}>
                                {wr.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* スマホ: 月間カレンダー */}
              <div className="md:hidden">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #9ca3af' }}>
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', padding: '4px 0', fontSize: 11, fontWeight: 600, color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
                  const wr = workRecordsByDate[date]
                  const isToday = date === todayStr
                  const isHoliday = holidayDates.has(date)
                  const dow = new Date(`${date}T00:00:00`).getDay()
                  const numColor = isHoliday || dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : ''
                  const handleCellTap = () => {
                    if (!isCurrentMonth) return
                    setWorkDaySheetDate(date)
                  }
                  const isOvertime = !!wr && wr.work_type === 'normal' && actualMinutes(wr.start_time, wr.end_time, wr.break_minutes) > 480
                  const chipLabel = wr ? (isOvertime ? '残業' : WORK_TYPE_LABEL[wr.work_type]) : ''
                  const chipStyle = wr ? WORK_TYPE_LIGHT[isOvertime ? 'overtime' : wr.work_type] : null
                  return (
                    <div key={date} className="cal-cell" onClick={handleCellTap}
                      style={{
                        borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                        minHeight: 62, overflow: 'hidden', cursor: 'pointer',
                        backgroundColor: isToday ? '#eff6ff' : undefined,
                        opacity: isCurrentMonth ? 1 : 0.35, padding: '2px 1px',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: isToday ? 9999 : 0,
                          backgroundColor: isToday ? '#2563eb' : 'transparent',
                          color: isToday ? '#ffffff' : (numColor || '#374151'),
                          fontSize: 12, fontWeight: isToday ? 700 : 600, lineHeight: 1,
                        }}>
                          {dayNum}
                        </span>
                      </div>
                      {wr && chipStyle && (
                        <div style={{ backgroundColor: chipStyle.bg, borderLeft: `2px solid ${chipStyle.border}`, borderRadius: 2, padding: '1px 3px', margin: '2px 1px 0' }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: chipStyle.fg, lineHeight: '10px' }}>
                            {chipLabel}
                          </div>
                          {wr.work_type !== 'paid_leave' ? (
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#111827', lineHeight: '11px' }}>
                              {wr.start_time.slice(0, 5)}–{wr.end_time.slice(0, 5)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 8.5, fontWeight: 700, color: '#111827', lineHeight: '11px' }}>終日</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                </div>
              </div>
            </div>
          </div>
          {showMonthPicker && (
            <MonthPicker
              year={displayYear}
              month={displayMonth}
              onSelect={goToMonth}
              onClose={() => setShowMonthPicker(false)}
            />
          )}
          {/* スマホ: 日付タップで勤怠詳細ボトムシート */}
          {workDaySheetDate && (
            <WorkDaySheet
              date={workDaySheetDate}
              workRecord={workRecordsByDate[workDaySheetDate] ?? null}
              onClose={() => setWorkDaySheetDate(null)}
              onAdd={() => { setAddWorkDate(workDaySheetDate); setWorkDaySheetDate(null) }}
              onEdit={(wr) => { setEditWorkRecord(wr); setWorkDaySheetDate(null) }}
            />
          )}
          {(addWorkDate !== null || editWorkRecord !== null) && (
            <WorkRecordModal
              workRecord={editWorkRecord}
              defaultDate={addWorkDate ?? undefined}
              userId={profile.id}
              onClose={() => { setAddWorkDate(null); setEditWorkRecord(null); setSelectedWorkDate(null) }}
              onSaved={fetchWorkRecords}
            />
          )}
        </div>
      )}

      {/* Day sheet */}
      {daySheet && (
        <DaySheet
          date={daySheet}
          schedules={daySchedules}
          profiles={profiles}
          onClose={() => setDaySheet(null)}
          onAdd={() => { setAddDate(daySheet); setEditSchedule(null); setDaySheet(null) }}
          onEdit={(s) => { setEditSchedule(s); setAddDate(null); setDaySheet(null) }}
        />
      )}

      {/* Add / Edit modal */}
      {(addDate !== null || editSchedule !== null) && (
        <ScheduleModal
          schedule={editSchedule}
          defaultDate={addDate ?? undefined}
          userId={profile.id}
          profiles={profiles}
          onClose={() => { setAddDate(null); setEditSchedule(null) }}
          onSaved={fetchSchedules}
        />
      )}

      {/* スマホ: 新規追加FAB */}
      <button
        onClick={() => { if (view === 'schedule') setAddDate(fabDefaultDate); else setAddWorkDate(fabDefaultDate) }}
        className="md:hidden fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-2xl font-light shadow-lg flex items-center justify-center"
        aria-label={view === 'schedule' ? '予定を追加' : '勤怠を追加'}
      >
        +
      </button>
    </div>
  )
}

interface DaySheetProps {
  date: string
  schedules: Schedule[]
  profiles: UserProfile[]
  onClose: () => void
  onAdd: () => void
  onEdit: (s: Schedule) => void
}

function DaySheet({ date, schedules, profiles, onClose, onAdd, onEdit }: DaySheetProps) {
  const [, m, d] = date.split('-').map(Number)
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()]
  const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6

  const sorted = [...schedules].sort((a, b) => {
    if (!a.start_time && b.start_time) return -1
    if (a.start_time && !b.start_time) return 1
    if (!a.start_time && !b.start_time) return 0
    return (a.start_time ?? '').localeCompare(b.start_time ?? '')
  })

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className={`text-lg font-bold ${isWeekend ? 'text-red-500' : 'text-gray-900'}`}>
            {m}月{d}日 {dayOfWeek}曜日
          </h2>
          <button onClick={onAdd}
            className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white text-xl font-light">
            +
          </button>
        </div>
        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">予定なし</p>
          ) : (
            <div className="space-y-1">
              {sorted.map(s => {
                const p = profiles.find(pr => pr.id === s.created_by)
                const color = p?.color || userColor(s.created_by)
                const initial = p?.avatar_char || p?.name?.charAt(0) || '?'
                const isAllDay = !s.start_time
                return (
                  <div key={s.id} onClick={() => onEdit(s)}
                    className="flex items-start gap-3 py-3 cursor-pointer hover:bg-gray-50 rounded-xl px-2">
                    <div className="w-12 text-xs text-gray-400 text-right shrink-0 pt-1 leading-tight">
                      {isAllDay ? (
                        <span>終日</span>
                      ) : (
                        <>
                          <span className="block">{formatTime(s.start_time)}</span>
                          {s.end_time && <span className="block">{formatTime(s.end_time)}</span>}
                        </>
                      )}
                    </div>
                    <div style={{ borderLeftColor: color }} className="border-l-[3px] pl-3 flex-1 min-w-0 py-0.5">
                      <p className="text-xs font-semibold" style={{ color }}>{p?.name ?? '不明'}</p>
                      <p className="text-sm font-medium text-gray-900">{s.title}</p>
                      {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                    </div>
                    <div style={{ backgroundColor: color }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initial}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MonthPicker({ year, month, onSelect, onClose }: { year: number; month: number; onSelect: (y: number, m: number) => void; onClose: () => void }) {
  const ITEM_H = 48
  const years = Array.from({ length: 11 }, (_, i) => 2021 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const [selYear, setSelYear] = useState(year)
  const [selMonth, setSelMonth] = useState(month)
  const yearRef = useRef<HTMLDivElement>(null)
  const monthRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const yIdx = years.indexOf(year)
    const mIdx = month - 1
    yearRef.current?.scrollTo({ top: yIdx * ITEM_H, behavior: 'instant' as ScrollBehavior })
    monthRef.current?.scrollTo({ top: mIdx * ITEM_H, behavior: 'instant' as ScrollBehavior })
  }, [])

  const onYearScroll = () => {
    const idx = Math.round((yearRef.current?.scrollTop ?? 0) / ITEM_H)
    setSelYear(years[Math.max(0, Math.min(idx, years.length - 1))])
  }
  const onMonthScroll = () => {
    const idx = Math.round((monthRef.current?.scrollTop ?? 0) / ITEM_H)
    setSelMonth(months[Math.max(0, Math.min(idx, months.length - 1))])
  }

  const PAD = ITEM_H * 2

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute top-20 left-4 right-4 max-w-xs mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="relative flex" style={{ height: ITEM_H * 5 }}>
          {/* 選択ハイライト */}
          <div className="absolute inset-x-3 rounded-xl bg-gray-100 pointer-events-none"
            style={{ top: ITEM_H * 2, height: ITEM_H, zIndex: 0 }} />
          {/* 年列 */}
          <div ref={yearRef} onScroll={onYearScroll} className="drum-col flex-1 overflow-y-scroll"
            style={{ scrollSnapType: 'y mandatory', position: 'relative', zIndex: 1 }}>
            <div style={{ height: PAD }} />
            {years.map(y => (
              <div key={y} className={`flex items-center justify-center text-sm transition-all ${y === selYear ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}>
                {y}年
              </div>
            ))}
            <div style={{ height: PAD }} />
          </div>
          {/* 月列 */}
          <div ref={monthRef} onScroll={onMonthScroll} className="drum-col flex-1 overflow-y-scroll"
            style={{ scrollSnapType: 'y mandatory', position: 'relative', zIndex: 1 }}>
            <div style={{ height: PAD }} />
            {months.map(m => (
              <div key={m} className={`flex items-center justify-center text-sm transition-all ${m === selMonth ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}>
                {m}月
              </div>
            ))}
            <div style={{ height: PAD }} />
          </div>
        </div>
        <div className="flex border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-3 text-sm text-gray-500 hover:bg-gray-50">キャンセル</button>
          <button onClick={() => onSelect(selYear, selMonth)}
            className="flex-1 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 border-l border-gray-100">確定</button>
        </div>
      </div>
    </div>
  )
}

function parseTo12h(val: string) {
  if (!val) return { ampm: 'AM', hour: '', minute: '00' }
  const [h, m] = val.split(':').map(Number)
  return { ampm: h < 12 ? 'AM' : 'PM', hour: String(h % 12 === 0 ? 12 : h % 12), minute: String(m).padStart(2, '0') }
}

function to24h(ampm: string, hour: string, minute: string) {
  if (!hour) return ''
  let h = Number(hour)
  if (ampm === 'AM' && h === 12) h = 0
  if (ampm === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2, '0')}:${minute}`
}

function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const display = value ? formatTime(value) : '-- : --'
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-left text-gray-900 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
        {display || <span className="text-gray-400">タップして選択</span>}
      </button>
      {open && (
        <TimePickerSheet
          value={value}
          onSelect={(v) => { onChange(v); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function TimePickerSheet({ value, onSelect, onClose }: { value: string; onSelect: (v: string) => void; onClose: () => void }) {
  const ITEM_H = 48
  const parsed = parseTo12h(value)
  const initAmpm = parsed.ampm === 'AM' ? '午前' : '午後'
  const initHour = parsed.hour ? Number(parsed.hour) : 9
  const initMinute = Number(parsed.minute || '0')

  const ampmList = ['午前', '午後']
  const hourList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const minuteList = Array.from({ length: 60 }, (_, i) => i)

  const [selAmpm, setSelAmpm] = useState(initAmpm)
  const [selHour, setSelHour] = useState(initHour)
  const [selMinute, setSelMinute] = useState(initMinute)

  const selAmpmRef = useRef(initAmpm)
  const selHourRef = useRef(initHour)
  const selMinuteRef = useRef(initMinute)

  const ampmRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)
  const PAD = ITEM_H * 2

  useEffect(() => {
    ampmRef.current?.scrollTo({ top: ampmList.indexOf(initAmpm) * ITEM_H, behavior: 'instant' as ScrollBehavior })
    hourRef.current?.scrollTo({ top: hourList.indexOf(initHour) * ITEM_H, behavior: 'instant' as ScrollBehavior })
    minuteRef.current?.scrollTo({ top: initMinute * ITEM_H, behavior: 'instant' as ScrollBehavior })
  }, [])

  const onAmpmScroll = () => {
    const idx = Math.round((ampmRef.current?.scrollTop ?? 0) / ITEM_H)
    const val = ampmList[Math.max(0, Math.min(idx, ampmList.length - 1))]
    selAmpmRef.current = val; setSelAmpm(val)
  }
  const onHourScroll = () => {
    const idx = Math.round((hourRef.current?.scrollTop ?? 0) / ITEM_H)
    const val = hourList[Math.max(0, Math.min(idx, hourList.length - 1))]
    selHourRef.current = val; setSelHour(val)
  }
  const onMinuteScroll = () => {
    const idx = Math.round((minuteRef.current?.scrollTop ?? 0) / ITEM_H)
    const val = minuteList[Math.max(0, Math.min(idx, minuteList.length - 1))]
    selMinuteRef.current = val; setSelMinute(val)
  }

  const handleConfirm = () => {
    const ampm = selAmpmRef.current
    const hour = selHourRef.current
    const minute = selMinuteRef.current
    const h24 = ampm === '午前' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
    onSelect(`${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }

  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="relative flex mx-4 my-3" style={{ height: ITEM_H * 5 }}>
          <div className="absolute inset-x-0 rounded-xl bg-gray-100 pointer-events-none" style={{ top: ITEM_H * 2, height: ITEM_H }} />
          {/* 午前/午後 */}
          <div ref={ampmRef} onScroll={onAmpmScroll} className="drum-col flex-1 overflow-y-scroll" style={{ scrollSnapType: 'y mandatory', zIndex: 1 }}>
            <div style={{ height: PAD }} />
            {ampmList.map(a => (
              <div key={a} className={`flex items-center justify-center text-base transition-all ${a === selAmpm ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}>{a}</div>
            ))}
            <div style={{ height: PAD }} />
          </div>
          {/* 時 */}
          <div ref={hourRef} onScroll={onHourScroll} className="drum-col flex-1 overflow-y-scroll" style={{ scrollSnapType: 'y mandatory', zIndex: 1 }}>
            <div style={{ height: PAD }} />
            {hourList.map(h => (
              <div key={h} className={`flex items-center justify-center text-base transition-all ${h === selHour ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}>{h}時</div>
            ))}
            <div style={{ height: PAD }} />
          </div>
          {/* 分 */}
          <div ref={minuteRef} onScroll={onMinuteScroll} className="drum-col flex-1 overflow-y-scroll" style={{ scrollSnapType: 'y mandatory', zIndex: 1 }}>
            <div style={{ height: PAD }} />
            {minuteList.map(m => (
              <div key={m} className={`flex items-center justify-center text-base transition-all ${m === selMinute ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}>{String(m).padStart(2, '0')}分</div>
            ))}
            <div style={{ height: PAD }} />
          </div>
        </div>
        <div className="flex border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-3 text-sm text-gray-500 hover:bg-gray-50">キャンセル</button>
          <button onClick={handleConfirm} className="flex-1 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 border-l border-gray-100">確定</button>
        </div>
      </div>
    </div>
  )
}

interface ScheduleModalProps {
  schedule: Schedule | null
  defaultDate?: string
  userId: string
  profiles: UserProfile[]
  onClose: () => void
  onSaved: () => void
}

function ScheduleModal({ schedule, defaultDate, userId, profiles, onClose, onSaved }: ScheduleModalProps) {
  const creator = schedule ? profiles.find(p => p.id === schedule.created_by) : null
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [date, setDate] = useState(schedule?.date ?? defaultDate ?? new Date().toLocaleDateString('sv-SE'))
  const [allDay, setAllDay] = useState(!schedule?.start_time)
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
      const payload = {
        title, date,
        start_time: allDay ? null : (startTime || null),
        end_time: allDay ? null : (endTime || null),
        notes: notes || null,
        created_by: userId,
      }
      if (schedule) {
        await createClient().from('schedules').update(payload).eq('id', schedule.id)
      } else {
        await createClient().from('schedules').insert(payload)
      }
      onSaved(); onClose()
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
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-1">{schedule ? '予定を編集' : '予定を追加'}</h2>
        {creator && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: creator.color || userColor(creator.id) }} />
            登録者：{creator.name}
          </div>
        )}
        {!creator && <div className="mb-2" />}
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
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-4 h-4" />
            終日
          </label>
          {!allDay && (
            <>
              <TimePicker value={startTime} onChange={setStartTime} label="開始時刻" />
              <TimePicker value={endTime} onChange={setEndTime} label="終了時刻" />
            </>
          )}
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

interface WorkDaySheetProps {
  date: string
  workRecord: WorkRecord | null
  onClose: () => void
  onEdit: (wr: WorkRecord) => void
  onAdd: () => void
}

function WorkDaySheet({ date, workRecord, onClose, onEdit, onAdd }: WorkDaySheetProps) {
  const [, m, d] = date.split('-').map(Number)
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()]
  const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6

  function fmtTime(t: string) {
    const [h, min] = t.slice(0, 5).split(':')
    return `${h}:${min}`
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl max-h-[60vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className={`text-lg font-bold ${isWeekend ? 'text-red-500' : 'text-gray-900'}`}>
            {m}月{d}日 {dayOfWeek}曜日
          </h2>
          {!workRecord && (
            <button onClick={onAdd}
              className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white text-xl font-light">
              +
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {workRecord ? (
            <div onClick={() => onEdit(workRecord)}
              className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-gray-50 cursor-pointer">
              <div style={{ backgroundColor: WORK_TYPE_COLOR[workRecord.work_type] }}
                className="px-2 py-1 rounded text-white text-xs font-bold shrink-0">
                {WORK_TYPE_LABEL[workRecord.work_type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {fmtTime(workRecord.start_time)} 〜 {fmtTime(workRecord.end_time)}
                  <span className="text-xs text-gray-400 ml-2">休憩{workRecord.break_minutes}分</span>
                </p>
                {workRecord.notes && <p className="text-xs text-gray-400 mt-0.5">{workRecord.notes}</p>}
              </div>
              <span className="text-xs text-gray-400">編集 ›</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">勤怠記録なし</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface WorkRecordModalProps {
  workRecord: WorkRecord | null
  defaultDate?: string
  userId: string
  onClose: () => void
  onSaved: () => void
}

function WorkRecordModal({ workRecord, defaultDate, userId, onClose, onSaved }: WorkRecordModalProps) {
  const [workType, setWorkType] = useState<WorkType>(workRecord?.work_type ?? 'normal')
  const [date, setDate] = useState(workRecord?.work_date ?? defaultDate ?? '')
  const [startTime, setStartTime] = useState(workRecord?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(workRecord?.end_time?.slice(0, 5) ?? '18:00')
  const [breakMinutes, setBreakMinutes] = useState(String(workRecord?.break_minutes ?? 60))
  const [notes, setNotes] = useState(workRecord?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPaidLeave = workType === 'paid_leave'  // 時間入力不要

  const handleSave = async () => {
    if (!date || (!isPaidLeave && (!startTime || !endTime))) return
    setError(null)
    setSaving(true)
    try {
      const payload = {
        user_id: userId,
        work_date: date,
        start_time: isPaidLeave ? '00:00' : startTime,
        end_time: isPaidLeave ? '00:00' : endTime,
        break_minutes: isPaidLeave ? 0 : (Number(breakMinutes) || 0),
        work_type: workType,
        notes: notes || null,
      }
      if (workRecord) {
        await createClient().from('work_records').update(payload).eq('id', workRecord.id)
      } else {
        await createClient().from('work_records').insert(payload)
      }
      onSaved(); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!workRecord || !confirm('削除しますか？')) return
    setSaving(true)
    await createClient().from('work_records').delete().eq('id', workRecord.id)
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">{workRecord ? '勤怠を編集' : '勤怠を追加'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付 *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">勤務区分</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map(t => (
                <button key={t} type="button" onClick={() => setWorkType(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    backgroundColor: workType === t ? WORK_TYPE_COLOR[t] : 'white',
                    color: workType === t ? 'white' : '#374151',
                    borderColor: workType === t ? WORK_TYPE_COLOR[t] : '#d1d5db',
                  }}>
                  {WORK_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {!isPaidLeave && (
            <>
              <TimePicker value={startTime} onChange={setStartTime} label="開始時刻 *" />
              <TimePicker value={endTime} onChange={setEndTime} label="終了時刻 *" />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">休憩時間（分）</label>
                <select value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[0, 15, 30, 45, 60, 75, 90, 120].map(m => (
                    <option key={m} value={String(m)}>{m}分</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          {workRecord && (
            <button onClick={handleDelete} disabled={saving} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !date || (!isPaidLeave && (!startTime || !endTime))}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
