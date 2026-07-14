import { Profile, WorkRecord } from '@/lib/supabase/types'

export interface PayrollRow {
  profile: Profile
  regularHours: number
  overtimeHours: number
  holidayHours: number
  workDays: number
  baseSalary: number
  overtimePay: number
  holidayPay: number
  transportation: number
  fixedAllowance: number
  bonusAmount: number
  totalSalary: number
}

export function calcPayroll(profile: Profile, records: WorkRecord[], bonus: number): Omit<PayrollRow, 'profile'> {
  let regularMin = 0
  let overtimeMin = 0
  let holidayMin = 0
  const workDates = new Set<string>()

  for (const r of records) {
    const min = r.actual_minutes ?? 0
    workDates.add(r.work_date)
    if (r.work_type === 'overtime') overtimeMin += min
    else if (r.work_type === 'holiday') holidayMin += min
    else regularMin += min
  }

  const regularHours = regularMin / 60
  const overtimeHours = overtimeMin / 60
  const holidayHours = holidayMin / 60
  const workDays = workDates.size

  let baseSalary = 0
  let overtimePay = 0
  let holidayPay = 0

  if (profile.employment_type === 'hourly') {
    baseSalary = Math.floor(regularHours * profile.hourly_wage)
    overtimePay = Math.floor(overtimeHours * profile.hourly_wage * profile.overtime_rate)
    holidayPay = Math.floor(holidayHours * profile.hourly_wage * profile.holiday_rate)
  } else if (profile.employment_type === 'daily') {
    baseSalary = Math.floor(workDays * profile.daily_wage)
    overtimePay = Math.floor(overtimeHours * (profile.daily_wage / 8) * profile.overtime_rate)
    holidayPay = Math.floor(holidayHours * (profile.daily_wage / 8) * profile.holiday_rate)
  } else {
    baseSalary = profile.hourly_wage
    overtimePay = Math.floor(overtimeHours * (profile.hourly_wage / 160) * profile.overtime_rate)
    holidayPay = Math.floor(holidayHours * (profile.hourly_wage / 160) * profile.holiday_rate)
  }

  const totalSalary = baseSalary + overtimePay + holidayPay + profile.transportation + profile.fixed_allowance + bonus

  return {
    regularHours,
    overtimeHours,
    holidayHours,
    workDays,
    baseSalary,
    overtimePay,
    holidayPay,
    transportation: profile.transportation,
    fixedAllowance: profile.fixed_allowance,
    bonusAmount: bonus,
    totalSalary,
  }
}
