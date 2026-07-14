import { createClient } from '@/lib/supabase/server'
import { SalesRecord } from '@/lib/supabase/types'
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

  const photoCounts: Record<number, number> = {}
  if (records.length > 0) {
    const { data: photos } = await supabase
      .from('sales_photos')
      .select('id, sales_record_id')
      .in('sales_record_id', records.map(r => r.id))
    for (const p of photos ?? []) photoCounts[p.sales_record_id] = (photoCounts[p.sales_record_id] ?? 0) + 1
  }

  return (
    <SalesClient
      initialYearMonth={yearMonth}
      initialRecords={records}
      initialPhotoCounts={photoCounts}
    />
  )
}
