import { createClient } from '@/lib/supabase/server'
import { SalesRecord } from '@/lib/supabase/types'
import { getSalesPhotoSummary } from '@/lib/sales-photos'
import SalesClient from './SalesClient'

export default async function MySalesPage() {
  const supabase = await createClient()

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  // 閲覧は全員分（編集はクライアント側で自分の記録のみ許可）
  const [recordsRes, profilesRes] = await Promise.all([
    supabase
      .from('sales_records')
      .select('*')
      .gte('record_date', `${yearMonth}-01`)
      .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('record_date', { ascending: false }),
    supabase.from('profiles').select('id, name').eq('is_active', true),
  ])
  const records: SalesRecord[] = recordsRes.data ?? []
  const profiles: { id: string; name: string }[] = profilesRes.data ?? []

  const { counts: photoCounts, thumbs: photoThumbs } = await getSalesPhotoSummary(supabase, records.map(r => r.id))

  return (
    <SalesClient
      initialYearMonth={yearMonth}
      initialRecords={records}
      initialProfiles={profiles}
      initialPhotoCounts={photoCounts}
      initialPhotoThumbs={photoThumbs}
    />
  )
}
