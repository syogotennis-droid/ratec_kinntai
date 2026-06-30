export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export function calculateActualMinutes(startStr: string, endStr: string, breakMinutes: number): number {
  let start = parseTimeToMinutes(startStr)
  let end = parseTimeToMinutes(endStr)
  if (end <= start) end += 24 * 60
  return Math.max(0, end - start - (breakMinutes || 0))
}

function calculateLateNightMinutes(startStr: string, endStr: string): number {
  let start = parseTimeToMinutes(startStr)
  let end = parseTimeToMinutes(endStr)
  if (end <= start) end += 24 * 60
  const lnStart = 22 * 60
  const lnEnd = 29 * 60
  const overlapStart = Math.max(start, lnStart)
  const overlapEnd = Math.min(end, lnEnd)
  return Math.max(0, overlapEnd - overlapStart)
}

export interface HoursResult {
  regular_hours: number
  overtime_hours: number
  late_night_hours: number
  holiday_hours: number
  total_hours: number
  work_days: number
}

export function aggregateMonthlyHours(workRecords: any[], regularHoursPerDay = 8.0): HoursResult {
  let totalMinutes = 0, lateNightMinutes = 0, holidayMinutes = 0, workDays = 0
  for (const r of workRecords) {
    if (r.actual_minutes == null) continue
    if (r.work_type === 'holiday') holidayMinutes += r.actual_minutes
    else totalMinutes += r.actual_minutes
    lateNightMinutes += calculateLateNightMinutes(r.start_time, r.end_time)
    workDays++
  }
  const regularLimit = regularHoursPerDay * 60
  const overtimeMinutes = Math.max(0, totalMinutes - workDays * regularLimit)
  const regularMinutes = totalMinutes - overtimeMinutes
  const round2 = (v: number) => Math.round(v * 100) / 100
  return {
    regular_hours: round2(regularMinutes / 60),
    overtime_hours: round2(overtimeMinutes / 60),
    late_night_hours: round2(lateNightMinutes / 60),
    holiday_hours: round2(holidayMinutes / 60),
    total_hours: round2((totalMinutes + holidayMinutes) / 60),
    work_days: workDays,
  }
}

export interface PayResult {
  base_salary: number
  overtime_pay: number
  late_night_pay: number
  holiday_pay: number
  transportation: number
  allowances: number
  deductions: number
  gross_pay: number
}

export function calculatePayroll(user: any, hours: HoursResult): PayResult {
  const w = user.hourly_wage || 0
  const base = Math.round(hours.regular_hours * w)
  const overtime = Math.round(hours.overtime_hours * w * (user.overtime_rate || 1.25))
  const lateNight = Math.round(hours.late_night_hours * w * ((user.late_night_rate || 1.25) - 1))
  const holiday = Math.round(hours.holiday_hours * w * (user.holiday_rate || 1.35))
  const gross = base + overtime + lateNight + holiday + (user.transportation || 0) + (user.fixed_allowance || 0)
  return {
    base_salary: base,
    overtime_pay: overtime,
    late_night_pay: lateNight,
    holiday_pay: holiday,
    transportation: user.transportation || 0,
    allowances: user.fixed_allowance || 0,
    deductions: 0,
    gross_pay: gross,
  }
}
