import { createClient } from '@/lib/supabase/server'
import { Profile, WorkRecord } from '@/lib/supabase/types'
import HoursSummaryClient from './HoursSummaryClient'

export default async function HoursSummaryPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const profilesRes = await supabase.from('profiles').select('*').eq('is_active', true).eq('is_admin', false).order('employee_id')
  const profiles: Profile[] = profilesRes.data ?? []
  const initialUserId = profiles[0]?.id ?? null

  let initialRecords: WorkRecord[] = []
  if (initialUserId) {
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase.from('work_records').select('*')
      .eq('user_id', initialUserId)
      .gte('work_date', `${yearMonth}-01`)
      .lte('work_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
    initialRecords = data ?? []
  }

  return (
    <HoursSummaryClient
      profiles={profiles}
      initialUserId={initialUserId}
      initialYearMonth={yearMonth}
      initialRecords={initialRecords}
    />
  )
}
