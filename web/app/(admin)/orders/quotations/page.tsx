import { createClient } from '@/lib/supabase/server'
import QuotationList from './QuotationList'

export default async function QuotationsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('quotations')
    .select('*, projects(name, companies(name))')
    .order('issue_date', { ascending: false })
  return <QuotationList initialQuotations={data ?? []} />
}
