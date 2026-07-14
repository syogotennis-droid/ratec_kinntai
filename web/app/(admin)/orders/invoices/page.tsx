import { createClient } from '@/lib/supabase/server'
import InvoiceList from './InvoiceList'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invoices')
    .select('*, projects(name, companies(name))')
    .order('issue_date', { ascending: false })
  return <InvoiceList initialInvoices={data ?? []} />
}
