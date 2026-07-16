'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, WorkRecord } from '@/lib/supabase/types'
import { calcDailyHours, sumHours, formatHours } from './hours'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

interface HoursSummaryClientProps {
  profiles: Profile[]
  initialUserId: string | null
  initialYearMonth: string
  initialRecords: WorkRecord[]
}

export default function HoursSummaryClient({ profiles, initialUserId, initialYearMonth, initialRecords }: HoursSummaryClientProps) {
  const [userId, setUserId] = useState(initialUserId)
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [records, setRecords] = useState<WorkRecord[]>(initialRecords)
  const [loading, setLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    if (!userId) { setRecords([]); return }
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase.from('work_records').select('*')
      .eq('user_id', userId)
      .gte('work_date', `${yearMonth}-01`)
      .lte('work_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
    setRecords(data ?? [])
    setLoading(false)
  }, [userId, yearMonth])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchRecords()
  }, [fetchRecords])

  const dailyHours = useMemo(() => calcDailyHours(records), [records])
  const totals = useMemo(() => sumHours(dailyHours), [dailyHours])

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

  const calendarDays = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    const numWeeks = Math.ceil((firstDay + daysInMonth) / 7)
    const totalCells = numWeeks * 7
    const days: Array<{ date: string; dayNum: number; isCurrentMonth: boolean }> = []
    const prevDays = new Date(y, m - 1, 0).getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
      const pd = new Date(y, m - 2, 1)
      const d = prevDays - i
      days.push({ date: `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: true })
    }
    const nd = new Date(y, m, 1)
    let ndd = 1
    while (days.length < totalCells) {
      days.push({ date: `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(ndd).padStart(2, '0')}`, dayNum: ndd++, isCurrentMonth: false })
    }
    return days
  }, [yearMonth])

  const selectedProfile = profiles.find(p => p.id === userId)

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={userId ?? ''} onChange={e => setUserId(e.target.value || null)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
          <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        </div>
      </div>

      {!selectedProfile ? (
        <div className="text-sm text-gray-500 py-8 text-center">従業員がいません</div>
      ) : loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">区分</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs">労働時間</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs">深夜</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-700">
                    平日
                    <span className="block text-[10px] text-gray-400 font-normal">残業</span>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-orange-600">{formatHours(totals.overtimeMin)}h</td>
                  <td className="py-2 px-3 text-right font-bold text-indigo-600">{formatHours(totals.nightWeekdayMin)}h</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-gray-700">
                    休日
                    <span className="block text-[10px] text-gray-400 font-normal">出勤・うち残業 {formatHours(totals.holidayOvertimeMin)}h</span>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-red-600">{formatHours(totals.holidayMin)}h</td>
                  <td className="py-2 px-3 text-right font-bold text-indigo-600">{formatHours(totals.nightHolidayMin)}h</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const h = dailyHours[day.date]
              return (
                <div
                  key={day.date}
                  className={`min-h-[70px] rounded-lg border p-1 ${
                    day.isCurrentMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className={`text-[11px] mb-0.5 ${day.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}`}>{day.dayNum}</div>
                  {h && day.isCurrentMonth && (
                    <div className="space-y-0.5 leading-tight">
                      {h.overtimeMin > 0 && <div className="text-[10px] text-orange-600">残 {formatHours(h.overtimeMin)}</div>}
                      {h.holidayMin > 0 && <div className="text-[10px] text-red-600">休 {formatHours(h.holidayMin)}</div>}
                      {h.holidayOvertimeMin > 0 && <div className="text-[10px] text-red-500">休残 {formatHours(h.holidayOvertimeMin)}</div>}
                      {h.nightMin > 0 && <div className="text-[10px] text-indigo-600">深 {formatHours(h.nightMin)}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
