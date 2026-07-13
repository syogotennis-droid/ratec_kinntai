'use server'

import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface CreateEmployeeInput {
  employeeId: string
  name: string
  nameKana: string
  department: string
  employmentType: 'hourly' | 'daily' | 'monthly'
  hourlyWage: number
  dailyWage: number
  transportation: number
  fixedAllowance: number
  overtimeRate: number
  holidayRate: number
  isAdmin: boolean
  password: string
}

export async function createEmployee(input: CreateEmployeeInput) {
  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: `${input.employeeId}@ratec.local`,
    password: input.password,
    email_confirm: true,
  })

  if (authError) return { error: authError.message }
  if (!authData.user) return { error: 'ユーザー作成に失敗しました' }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    employee_id: input.employeeId,
    name: input.name,
    name_kana: input.nameKana || null,
    department: input.department || null,
    employment_type: input.employmentType,
    hourly_wage: input.hourlyWage,
    daily_wage: input.dailyWage,
    transportation: input.transportation,
    fixed_allowance: input.fixedAllowance,
    overtime_rate: input.overtimeRate,
    holiday_rate: input.holidayRate,
    is_admin: input.isAdmin,
    is_active: true,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  return { success: true }
}
