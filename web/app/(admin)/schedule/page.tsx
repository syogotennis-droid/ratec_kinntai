import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session!.user.id

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const firstDate = `${yearMonth}-01`
  const lastDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  const [{ data: schedules }, { data: workRecords }, { data: profiles }] = await Promise.all([
    supabase
      .from('schedules')
      .select('*')
      .gte('date', firstDate)
      .lte('date', lastDate)
      .order('date')
      .order('start_time'),
    supabase
      .from('work_records')
      .select('*')
      .eq('user_id', userId)
      .gte('work_date', firstDate)
      .lte('work_date', lastDate),
    supabase
      .from('profiles')
      .select('id, name, avatar_char, color')
      .eq('is_active', true),
  ])

  return (
    <ScheduleClient
      initialYearMonth={yearMonth}
      initialSchedules={schedules ?? []}
      initialWorkRecords={workRecords ?? []}
      initialProfiles={profiles ?? []}
    />
  )
}
