import { WorkRecord } from '@/lib/supabase/types'

export interface DailyHours {
  date: string
  overtimeMin: number
  holidayMin: number
  holidayOvertimeMin: number
  nightMin: number
}

export interface HoursTotals {
  overtimeMin: number
  holidayMin: number
  holidayOvertimeMin: number
  nightMin: number
}

// 1日の所定労働時間（これを超える休日出勤は「休日出勤の残業」として別集計する）
const STANDARD_DAY_MIN = 480

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
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

export function calcDailyHours(records: WorkRecord[]): Record<string, DailyHours> {
  const byDate = records.reduce<Record<string, WorkRecord[]>>((acc, r) => {
    (acc[r.work_date] ??= []).push(r)
    return acc
  }, {})

  const result: Record<string, DailyHours> = {}
  for (const [date, dayRecords] of Object.entries(byDate)) {
    let overtimeMin = 0
    let holidayMin = 0
    let nightMin = 0
    for (const r of dayRecords) {
      const min = r.actual_minutes ?? 0
      if (r.work_type === 'overtime') overtimeMin += min
      else if (r.work_type === 'holiday') holidayMin += min
      if (r.work_type !== 'paid_leave') nightMin += calcNightMinutes(r.start_time, r.end_time)
    }
    result[date] = {
      date,
      overtimeMin,
      holidayMin,
      holidayOvertimeMin: Math.max(0, holidayMin - STANDARD_DAY_MIN),
      nightMin,
    }
  }
  return result
}

export function sumHours(daily: Record<string, DailyHours>): HoursTotals {
  return Object.values(daily).reduce<HoursTotals>((acc, d) => ({
    overtimeMin: acc.overtimeMin + d.overtimeMin,
    holidayMin: acc.holidayMin + d.holidayMin,
    holidayOvertimeMin: acc.holidayOvertimeMin + d.holidayOvertimeMin,
    nightMin: acc.nightMin + d.nightMin,
  }), { overtimeMin: 0, holidayMin: 0, holidayOvertimeMin: 0, nightMin: 0 })
}

export function formatHours(min: number): string {
  return (min / 60).toFixed(1)
}
