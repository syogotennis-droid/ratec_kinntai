'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, WorkRecord } from '@/lib/supabase/types'
import { calcDailyHours, sumHours, formatHours, weekendOrHolidayKind } from './hours'
import MobileMenuButton from '@/components/ui/MobileMenuButton'

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
    <div className="px-4 pt-2 pb-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <MobileMenuButton />
        <select value={userId ?? ''} onChange={e => setUserId(e.target.value || null)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-1.5 px-2 font-medium text-gray-500 text-xs whitespace-nowrap">区分</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500 text-xs">残業<span className="block font-normal text-[10px]">休は出勤</span></th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500 text-xs">深夜<span className="block font-normal text-[10px]">基本/残業込</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 px-2 font-medium text-gray-700 whitespace-nowrap">平日</td>
                  <td className="py-1.5 px-2 text-right font-bold text-orange-600">{formatHours(totals.overtimeMin)}h</td>
                  <td className="py-1.5 px-2 text-right font-bold text-indigo-600">
                    {formatHours(totals.nightWeekdayBaseMin)}h<span className="text-gray-400 font-normal">/</span>{formatHours(totals.nightWeekdayOvertimeMin)}h
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 font-medium text-gray-700 whitespace-nowrap">休日</td>
                  <td className="py-1.5 px-2 text-right font-bold text-red-600">
                    {formatHours(totals.holidayMin)}h
                    <span className="block text-[10px] text-gray-400 font-normal">内残業{formatHours(totals.holidayOvertimeMin)}h</span>
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold text-indigo-600">
                    {formatHours(totals.nightHolidayBaseMin)}h<span className="text-gray-400 font-normal">/</span>{formatHours(totals.nightHolidayOvertimeMin)}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2">
            {[
              { label: '残', text: '残業', color: 'text-orange-600 bg-orange-50' },
              { label: '休', text: '休日出勤', color: 'text-red-600 bg-red-50' },
              { label: '休残', text: '休日残業', color: 'text-red-500 bg-red-50' },
              { label: '深', text: '深夜', color: 'text-indigo-600 bg-indigo-50' },
              { label: '深残', text: '深夜(残業込)', color: 'text-indigo-500 bg-indigo-50' },
            ].map(({ label, text, color }) => (
              <span key={label} className={`text-[11px] px-1.5 py-0.5 rounded ${color}`}>
                <span className="font-bold">{label}</span>＝{text}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map(day => {
              const h = dailyHours[day.date]
              const kind = weekendOrHolidayKind(day.date)
              const dayNumColor = !day.isCurrentMonth
                ? 'text-gray-300'
                : kind === 'sat' ? 'text-blue-500' : kind === 'sun_or_holiday' ? 'text-red-500' : 'text-gray-700'
              return (
                <div
                  key={day.date}
                  className={`min-h-[92px] rounded border p-1 ${
                    day.isCurrentMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className={`text-xs font-medium ${dayNumColor}`}>{day.dayNum}</div>
                  {h && day.isCurrentMonth && (
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {h.overtimeMin > 0 && <span className="text-[11px] leading-tight text-orange-600 font-medium">残{formatHours(h.overtimeMin)}</span>}
                      {h.holidayMin > 0 && <span className="text-[11px] leading-tight text-red-600 font-medium">休{formatHours(h.holidayMin)}</span>}
                      {h.holidayOvertimeMin > 0 && <span className="text-[11px] leading-tight text-red-500 font-medium">休残{formatHours(h.holidayOvertimeMin)}</span>}
                      {h.nightBaseMin > 0 && <span className="text-[11px] leading-tight text-indigo-600 font-medium">深{formatHours(h.nightBaseMin)}</span>}
                      {h.nightOvertimeMin > 0 && <span className="text-[11px] leading-tight text-indigo-500 font-medium">深残{formatHours(h.nightOvertimeMin)}</span>}
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
