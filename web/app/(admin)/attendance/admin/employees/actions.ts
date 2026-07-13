'use server'

import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error(`env missing: url=${!!url} key=${!!key}`)
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
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

export async function createEmployee(input: CreateEmployeeInput): Promise<{ error?: string; success?: boolean }> {
  try {
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: `${input.employeeId}@ratec.local`,
      password: input.password,
      email_confirm: true,
    })

    if (authError) return { error: `auth: ${authError.message}` }
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
      return { error: `profile: ${profileError.message}` }
    }

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
