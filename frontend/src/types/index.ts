export interface User {
  id: number
  employee_id: string
  name: string
  name_kana: string | null
  email: string
  department: string | null
  employment_type: 'hourly' | 'daily' | 'monthly'
  hourly_wage: number
  daily_wage: number
  transportation: number
  fixed_allowance: number
  overtime_rate: number
  late_night_rate: number
  holiday_rate: number
  is_admin: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkRecord {
  id: number
  user_id: number
  work_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  break_minutes: number
  actual_minutes: number | null
  work_type: 'normal' | 'overtime' | 'holiday' | 'training' | 'paid_leave'
  notes: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface WorkRecordCreate {
  user_id: number
  work_date: string
  start_time: string
  end_time: string
  break_minutes: number
  work_type: 'normal' | 'overtime' | 'holiday' | 'training' | 'paid_leave'
  notes?: string
}

export interface PayrollRecord {
  id: number
  year_month: string
  user_id: number
  regular_hours: number
  overtime_hours: number
  late_night_hours: number
  holiday_hours: number
  total_hours: number
  base_salary: number
  overtime_pay: number
  late_night_pay: number
  holiday_pay: number
  transportation: number
  allowances: number
  deductions: number
  gross_pay: number
  additional_notes: string | null
  status: 'calculated' | 'confirmed'
  confirmed_at: string | null
}

export interface MonthlySummary {
  user_id: number
  user_name: string
  year_month: string
  total_hours: number
  regular_hours: number
  overtime_hours: number
  late_night_hours: number
  holiday_hours: number
  work_days: number
  closing_status: string
}

export interface MonthlyClosing {
  id: number
  year_month: string
  user_id: number
  status: 'open' | 'closed'
  closed_at: string | null
}
