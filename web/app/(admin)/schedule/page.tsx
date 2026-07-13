'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/profile-context'
import holidayJp from '@holiday-jp/holiday_jp'

interface CalEvent {
  title: string
  date: string
  backgroundColor: string
  textColor: string
  isHoliday?: boolean
}

interface Schedule {
  id: number
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

interface UserProfile {
  id: string
  name: string
  avatar_char: string | null
  color: string | null
}

const USER_COLORS = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7',
  '#ef4444', '#06b6d4', '#eab308', '#ec4899',
]

function userColor(userId: string | null) {
  if (!userId) return USER_COLORS[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return USER_COLORS[hash % USER_COLORS.length]
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function colorBg(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},0.15)`
}

function colorDark(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.floor(r * 0.55)},${Math.floor(g * 0.55)},${Math.floor(b * 0.55)})`
}

function bestTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 130 ? '#1f2937' : '#ffffff'
}

function formatTime(t: string | null) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? '午前' : '午後'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${ampm}${hour}:${String(m).padStart(2, '0')}`
}

export default function SchedulePage() {
  const profile = useProfile()
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const touchStartX = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [sliding, setSliding] = useState(false)
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
      .select('*')
      .gte('date', `${yearMonth}-01`)
      .lte('date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('date')
      .order('start_time')
    setSchedules(data ?? [])
    setLoading(false)
  }, [yearMonth])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  useEffect(() => {
    createClient().from('profiles').select('id, name, avatar_char, color').eq('is_active', true).then(({ data }) => {
      setProfiles(data ?? [])
    })
  }, [])

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

  const calEvents: CalEvent[] = schedules.map(s => {
    const p = profiles.find(pr => pr.id === s.created_by)
    const vividColor = p?.color || userColor(s.created_by)
    return { title: s.title, date: s.date, backgroundColor: vividColor, textColor: bestTextColor(vividColor) }
  })

  const allEvents = [...holidayEvents, ...calEvents]

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
    return allEvents.reduce<Record<string, CalEvent[]>>((acc, e) => {
      if (!acc[e.date]) acc[e.date] = []
      acc[e.date].push(e)
      return acc
    }, {})
  }, [allEvents])

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }, [])

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

  const daySchedules = daySheet ? (schedules.filter(s => s.date === daySheet)) : []

  const currentView = view
  const viewToggle = (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
      <button onClick={() => setView('calendar')}
        className={`px-3 py-1.5 transition-colors ${currentView === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
        📅 カレンダー
      </button>
      <button onClick={() => setView('list')}
        className={`px-3 py-1.5 transition-colors ${currentView === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
        📋 リスト
      </button>
    </div>
  )

  return (
    <div className="px-2 pt-2 pb-0">

      {view === 'calendar' ? (
        <>
          <style>{`
            .drum-col { scrollbar-width: none; -ms-overflow-style: none; }
            .drum-col::-webkit-scrollbar { display: none; }
          `}</style>
          {/* Header */}
          <div className="flex items-center justify-between px-2 mb-1">
            <button onClick={() => setShowMonthPicker(true)}
              className="flex items-center gap-1 text-base font-bold text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100">
              {displayYear}年{displayMonth}月
              <span className="text-gray-400 text-xs">▾</span>
            </button>
            {viewToggle}
          </div>
          {/* Swipe wrapper */}
          <div style={{ overflow: 'hidden' }}>
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ transform: `translateX(${dragX}px)`, transition: sliding ? 'transform 220ms ease-out' : 'none', willChange: 'transform' }}
            >
              {/* Calendar grid */}
              <div style={{ height: 'calc(100vh - 108px)', display: 'flex', flexDirection: 'column' }}>
                {/* Day-of-week header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} style={{ textAlign: 'center', padding: '3px 0', fontSize: 10, fontWeight: 600, color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numWeeks}, 1fr)` }}>
                  {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
                    const dayEvts = eventsByDate[date] ?? []
                    const isToday = date === todayStr
                    const isHoliday = holidayDates.has(date)
                    const dow = new Date(`${date}T00:00:00`).getDay()
                    const maxPerCell = numWeeks >= 6 ? 3 : numWeeks === 5 ? 5 : 6
                    const shown = dayEvts.slice(0, maxPerCell)
                    const extra = dayEvts.length - maxPerCell
                    const numColor = isHoliday || dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : ''
                    return (
                      <div
                        key={date}
                        onClick={() => setDaySheet(date)}
                        style={{
                          borderRight: '1px solid #f3f4f6',
                          borderBottom: '1px solid #f3f4f6',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: isToday ? '#fefce8' : undefined,
                          opacity: isCurrentMonth ? 1 : 0.35,
                        }}
                      >
                        <div style={{ fontSize: 10, padding: '1px 2px', lineHeight: '14px', color: numColor || '#374151', fontWeight: isToday ? 700 : 400 }}>
                          {dayNum}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
                          {shown.map((e, i) => (
                            <div key={i} style={{ backgroundColor: e.backgroundColor, color: e.textColor, fontSize: 10, fontWeight: 500, lineHeight: '16px', padding: '0 2px', borderRadius: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0, marginBottom: 1 }}>
                              {e.title}
                            </div>
                          ))}
                          {extra > 0 && (
                            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: '14px', paddingLeft: 2, fontWeight: 500, flexShrink: 0 }}>+{extra}</div>
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
        </>
      ) : (
        <div className="max-w-xl px-2">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">‹</button>
            <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">›</button>
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
                        <div key={s.id} onClick={() => { setDaySheet(date) }}
                          className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors">
                          <span className="text-xs text-gray-400 shrink-0 pt-0.5 w-12 text-right">
                            {s.start_time ? formatTime(s.start_time) : '終日'}
                          </span>
                          <div style={{ borderLeftColor: (() => { const pr = profiles.find(x => x.id === s.created_by); return colorDark(pr?.color || userColor(s.created_by)) })() }} className="border-l-[3px] pl-2 flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{s.title}</p>
                            {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                          </div>
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
          onClose={() => { setAddDate(null); setEditSchedule(null) }}
          onSaved={fetchSchedules}
        />
      )}
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
  const parsed = parseTo12h(value)
  const [ampm, setAmpm] = useState(parsed.ampm)
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const update = (a: string, h: string, m: string) => {
    setAmpm(a); setHour(h); setMinute(m)
    onChange(h ? to24h(a, h, m) : '')
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-1">
        <select value={ampm} onChange={e => update(e.target.value, hour, minute)}
          className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="AM">午前</option>
          <option value="PM">午後</option>
        </select>
        <select value={hour} onChange={e => update(ampm, e.target.value, minute)}
          className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">--</option>
          {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => <option key={h} value={String(h)}>{h}時</option>)}
        </select>
        <select value={minute} onChange={e => update(ampm, hour, e.target.value)}
          className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {['00','15','30','45'].map(m => <option key={m} value={m}>{m}分</option>)}
        </select>
      </div>
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
