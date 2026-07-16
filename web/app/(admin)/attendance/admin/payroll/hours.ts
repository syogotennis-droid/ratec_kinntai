import holidayJp from '@holiday-jp/holiday_jp'
import { WorkRecord } from '@/lib/supabase/types'

export interface DailyHours {
  date: string
  isHoliday: boolean
  overtimeMin: number
  holidayMin: number
  holidayOvertimeMin: number
  nightBaseMin: number
  nightOvertimeMin: number
}

export interface HoursTotals {
  overtimeMin: number
  holidayMin: number
  holidayOvertimeMin: number
  nightWeekdayBaseMin: number
  nightWeekdayOvertimeMin: number
  nightHolidayBaseMin: number
  nightHolidayOvertimeMin: number
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

// 出退勤時刻(と必要ならその日の中での積算所定内労働時間)から、絶対分(0時起点、日またぎは+1440)の開始・終了を返す
function toAbsRange(startTime: string, endTime: string): [number, number] {
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (end <= start) end += 24 * 60
  return [start, end]
}

// 22:00〜翌5:00の深夜時間帯と、絶対分で表した区間の重なりを計算する
function nightOverlapMinutes(startAbs: number, endAbs: number): number {
  if (endAbs <= startAbs) return 0
  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  let night = overlap(startAbs, endAbs, 22 * 60, 29 * 60)
  night += overlap(startAbs, endAbs, 22 * 60 - 24 * 60, 5 * 60)
  return night
}

// 土曜/日曜・祝日の判定（カレンダー表示の色分け用）
export function weekendOrHolidayKind(dateStr: string): 'sat' | 'sun_or_holiday' | null {
  const d = new Date(`${dateStr}T00:00:00`)
  const dow = d.getDay()
  if (dow === 6) return 'sat'
  if (dow === 0 || holidayJp.isHoliday(d)) return 'sun_or_holiday'
  return null
}

// 土日・祝日、または勤務区分が明示的に「休日」の場合を休日出勤扱いにする
function isOffDay(dateStr: string, explicitHoliday: boolean): boolean {
  if (explicitHoliday) return true
  return weekendOrHolidayKind(dateStr) !== null
}

export function calcDailyHours(records: WorkRecord[]): Record<string, DailyHours> {
  const byDate = records.reduce<Record<string, WorkRecord[]>>((acc, r) => {
    (acc[r.work_date] ??= []).push(r)
    return acc
  }, {})

  const result: Record<string, DailyHours> = {}
  for (const [date, dayRecords] of Object.entries(byDate)) {
    const explicitHoliday = dayRecords.some(r => r.work_type === 'holiday')
    const explicitOvertime = dayRecords.some(r => r.work_type === 'overtime')
    const isHoliday = isOffDay(date, explicitHoliday)

    const workRecords = dayRecords
      .filter(r => r.work_type !== 'paid_leave' && r.start_time !== r.end_time)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    let workedMin = 0
    let baseMin = 0 // 所定労働時間(8時間)以内の実働分
    let nightBaseMin = 0
    let nightOvertimeMin = 0

    for (const r of workRecords) {
      const [startAbs, endAbs] = toAbsRange(r.start_time, r.end_time)
      const recordWorkedMin = Math.max(0, endAbs - startAbs - r.break_minutes)
      workedMin += recordWorkedMin

      // 手動で「残業」区分にした記録はその区間全体を残業扱いにする
      const baseRemaining = explicitOvertime ? 0 : Math.max(0, STANDARD_DAY_MIN - baseMin)
      const baseThisRecord = Math.min(recordWorkedMin, baseRemaining)
      baseMin += baseThisRecord

      // 休憩は所定内労働の終わり(残業に入る前)に取るものと仮定して区切り時刻を決める
      const boundaryAbs = baseThisRecord >= recordWorkedMin ? endAbs : startAbs + baseThisRecord + r.break_minutes

      nightBaseMin += nightOverlapMinutes(startAbs, Math.min(boundaryAbs, endAbs))
      nightOvertimeMin += nightOverlapMinutes(Math.max(boundaryAbs, startAbs), endAbs)
    }

    let overtimeMin = 0
    let holidayMin = 0
    let holidayOvertimeMin = 0
    if (isHoliday) {
      holidayMin = workedMin
      holidayOvertimeMin = Math.max(0, workedMin - baseMin)
    } else {
      overtimeMin = Math.max(0, workedMin - baseMin)
    }

    result[date] = { date, isHoliday, overtimeMin, holidayMin, holidayOvertimeMin, nightBaseMin, nightOvertimeMin }
  }
  return result
}

export function sumHours(daily: Record<string, DailyHours>): HoursTotals {
  return Object.values(daily).reduce<HoursTotals>((acc, d) => ({
    overtimeMin: acc.overtimeMin + d.overtimeMin,
    holidayMin: acc.holidayMin + d.holidayMin,
    holidayOvertimeMin: acc.holidayOvertimeMin + d.holidayOvertimeMin,
    nightWeekdayBaseMin: acc.nightWeekdayBaseMin + (d.isHoliday ? 0 : d.nightBaseMin),
    nightWeekdayOvertimeMin: acc.nightWeekdayOvertimeMin + (d.isHoliday ? 0 : d.nightOvertimeMin),
    nightHolidayBaseMin: acc.nightHolidayBaseMin + (d.isHoliday ? d.nightBaseMin : 0),
    nightHolidayOvertimeMin: acc.nightHolidayOvertimeMin + (d.isHoliday ? d.nightOvertimeMin : 0),
  }), {
    overtimeMin: 0, holidayMin: 0, holidayOvertimeMin: 0,
    nightWeekdayBaseMin: 0, nightWeekdayOvertimeMin: 0, nightHolidayBaseMin: 0, nightHolidayOvertimeMin: 0,
  })
}

export function formatHours(min: number): string {
  return (min / 60).toFixed(1)
}
