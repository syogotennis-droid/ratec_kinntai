import holidayJp from '@holiday-jp/holiday_jp'
import { WorkRecord } from '@/lib/supabase/types'

export interface DailyHours {
  date: string
  isHoliday: boolean
  overtimeMin: number
  holidayMin: number
  holidayOvertimeMin: number
  nightMin: number
}

export interface HoursTotals {
  overtimeMin: number
  holidayMin: number
  holidayOvertimeMin: number
  nightWeekdayMin: number
  nightHolidayMin: number
}

// 1日の所定労働時間。これを超えた分を残業（休日は休日出勤の残業）として集計する。
// 従業員は勤務区分を「通常」のまま出退勤時刻だけ入力することがほとんどのため、
// actual_minutes(未設定なことが多い)や work_type='overtime'/'holiday' の手入力に
// 頼らず、時刻と日付から自動的に判定する。
const STANDARD_DAY_MIN = 480

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function calcWorkedMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (end <= start) end += 24 * 60
  return Math.max(0, end - start - breakMinutes)
}

// 22:00〜翌5:00の深夜時間帯とシフトの重なり分数を計算する
function calcNightMinutes(startTime: string, endTime: string): number {
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (end <= start) end += 24 * 60
  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  let night = overlap(start, end, 22 * 60, 29 * 60)
  night += overlap(start, end, 22 * 60 - 24 * 60, 5 * 60)
  return night
}

// 土日・祝日、または勤務区分が明示的に「休日」の場合を休日出勤扱いにする
function isOffDay(dateStr: string, explicitHoliday: boolean): boolean {
  if (explicitHoliday) return true
  const d = new Date(`${dateStr}T00:00:00`)
  const dow = d.getDay()
  return dow === 0 || dow === 6 || holidayJp.isHoliday(d)
}

export function calcDailyHours(records: WorkRecord[]): Record<string, DailyHours> {
  const byDate = records.reduce<Record<string, WorkRecord[]>>((acc, r) => {
    (acc[r.work_date] ??= []).push(r)
    return acc
  }, {})

  const result: Record<string, DailyHours> = {}
  for (const [date, dayRecords] of Object.entries(byDate)) {
    const workRecords = dayRecords.filter(r => r.work_type !== 'paid_leave' && r.start_time !== r.end_time)
    const workedMin = workRecords.reduce((s, r) => s + calcWorkedMinutes(r.start_time, r.end_time, r.break_minutes), 0)
    const nightMin = workRecords.reduce((s, r) => s + calcNightMinutes(r.start_time, r.end_time), 0)
    const explicitHoliday = dayRecords.some(r => r.work_type === 'holiday')
    const explicitOvertime = dayRecords.some(r => r.work_type === 'overtime')

    const isHoliday = isOffDay(date, explicitHoliday)
    let overtimeMin = 0
    let holidayMin = 0
    let holidayOvertimeMin = 0
    if (isHoliday) {
      holidayMin = workedMin
      holidayOvertimeMin = Math.max(0, workedMin - STANDARD_DAY_MIN)
    } else {
      overtimeMin = explicitOvertime ? workedMin : Math.max(0, workedMin - STANDARD_DAY_MIN)
    }

    result[date] = { date, isHoliday, overtimeMin, holidayMin, holidayOvertimeMin, nightMin }
  }
  return result
}

export function sumHours(daily: Record<string, DailyHours>): HoursTotals {
  return Object.values(daily).reduce<HoursTotals>((acc, d) => ({
    overtimeMin: acc.overtimeMin + d.overtimeMin,
    holidayMin: acc.holidayMin + d.holidayMin,
    holidayOvertimeMin: acc.holidayOvertimeMin + d.holidayOvertimeMin,
    nightWeekdayMin: acc.nightWeekdayMin + (d.isHoliday ? 0 : d.nightMin),
    nightHolidayMin: acc.nightHolidayMin + (d.isHoliday ? d.nightMin : 0),
  }), { overtimeMin: 0, holidayMin: 0, holidayOvertimeMin: 0, nightWeekdayMin: 0, nightHolidayMin: 0 })
}

export function formatHours(min: number): string {
  return (min / 60).toFixed(1)
}
