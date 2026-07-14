import { createClient } from '@/lib/supabase/server'
import { Profile, MonthlyClosing, WorkRecord } from '@/lib/supabase/types'
import WorkListClient, { EmployeeSummary } from './WorkListClient'

export default async function AdminWorkListPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const start = `${yearMonth}-01`
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  const [profilesRes, recordsRes, closingsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
    supabase.from('work_records').select('*').gte('work_date', start).lte('work_date', end),
    supabase.from('monthly_closings').select('*').eq('year_month', yearMonth),
  ])

  const profiles: Profile[] = profilesRes.data ?? []
  const records: WorkRecord[] = recordsRes.data ?? []
  const closings: MonthlyClosing[] = closingsRes.data ?? []

  const summaries: EmployeeSummary[] = profiles.map(profile => {
    const userRecords = records.filter(r => r.user_id === profile.id)
    const totalMinutes = userRecords.reduce((s, r) => s + (r.actual_minutes ?? 0), 0)
    const workDays = new Set(userRecords.map(r => r.work_date)).size
    const isClosed = closings.some(c => c.user_id === profile.id && c.status === 'closed')
    return { profile, totalMinutes, workDays, isClosed }
  })

  return <WorkListClient initialYearMonth={yearMonth} initialSummaries={summaries} initialAllRecords={records} />
}
