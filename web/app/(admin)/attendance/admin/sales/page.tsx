import { createClient } from '@/lib/supabase/server'
import { Profile, SalesRecord } from '@/lib/supabase/types'
import AdminSalesClient, { SalesWithProfile } from './AdminSalesClient'

export default async function AdminSalesPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  const [recordsRes, profilesRes] = await Promise.all([
    supabase.from('sales_records').select('*')
      .gte('record_date', `${yearMonth}-01`)
      .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('record_date', { ascending: false }),
    supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
  ])
  const profiles: Profile[] = profilesRes.data ?? []
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const records: SalesWithProfile[] = ((recordsRes.data ?? []) as SalesRecord[]).map(r => ({ ...r, profile: profileMap[r.user_id] }))

  const photoCounts: Record<number, number> = {}
  if (records.length > 0) {
    const { data: photos } = await supabase
      .from('sales_photos')
      .select('id, sales_record_id')
      .in('sales_record_id', records.map(r => r.id))
    for (const p of photos ?? []) photoCounts[p.sales_record_id] = (photoCounts[p.sales_record_id] ?? 0) + 1
  }

  return (
    <AdminSalesClient
      initialYearMonth={yearMonth}
      initialRecords={records}
      initialProfiles={profiles}
      initialPhotoCounts={photoCounts}
    />
  )
}
