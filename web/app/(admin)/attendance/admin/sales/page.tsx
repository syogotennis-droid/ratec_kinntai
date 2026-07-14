import { createClient } from '@/lib/supabase/server'
import { Profile, SalesRecord } from '@/lib/supabase/types'
import { getSalesPhotoSummary } from '@/lib/sales-photos'
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

  const { counts: photoCounts, thumbs: photoThumbs } = await getSalesPhotoSummary(supabase, records.map(r => r.id))

  return (
    <AdminSalesClient
      initialYearMonth={yearMonth}
      initialRecords={records}
      initialProfiles={profiles}
      initialPhotoCounts={photoCounts}
      initialPhotoThumbs={photoThumbs}
    />
  )
}
