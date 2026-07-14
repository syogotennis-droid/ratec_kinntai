import { createClient } from '@/lib/supabase/server'
import { SalesRecord } from '@/lib/supabase/types'
import { getSalesPhotoSummary } from '@/lib/sales-photos'
import SalesClient from './SalesClient'

export default async function MySalesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session!.user.id

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()

  const { data } = await supabase
    .from('sales_records')
    .select('*')
    .eq('user_id', userId)
    .gte('record_date', `${yearMonth}-01`)
    .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
    .order('record_date', { ascending: false })
  const records: SalesRecord[] = data ?? []

  const { counts: photoCounts, thumbs: photoThumbs } = await getSalesPhotoSummary(supabase, records.map(r => r.id))

  return (
    <SalesClient
      initialYearMonth={yearMonth}
      initialRecords={records}
      initialPhotoCounts={photoCounts}
      initialPhotoThumbs={photoThumbs}
    />
  )
}
