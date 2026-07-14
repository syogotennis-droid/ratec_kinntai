import { createClient } from '@/lib/supabase/server'
import { Profile, WorkRecord, Bonus } from '@/lib/supabase/types'
import PayrollClient from './PayrollClient'
import { PayrollRow, calcPayroll } from './calc'

export default async function PayrollPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  const [profilesRes, recordsRes, bonusesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
    supabase.from('work_records').select('*')
      .gte('work_date', `${yearMonth}-01`)
      .lte('work_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`),
    supabase.from('bonuses').select('*').eq('year_month', yearMonth),
  ])
  const profiles: Profile[] = profilesRes.data ?? []
  const records: WorkRecord[] = recordsRes.data ?? []
  const bonuses: Bonus[] = bonusesRes.data ?? []

  const rows: PayrollRow[] = profiles.map(profile => {
    const userRecords = records.filter(r => r.user_id === profile.id)
    const bonus = bonuses.find(b => b.user_id === profile.id)?.bonus_amount ?? 0
    return { profile, ...calcPayroll(profile, userRecords, bonus) }
  })

  return <PayrollClient initialYearMonth={yearMonth} initialRows={rows} />
}
