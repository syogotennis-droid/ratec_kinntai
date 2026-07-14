import { createClient } from '@/lib/supabase/server'
import PurchaseOrderList from './PurchaseOrderList'

export default async function PurchaseOrdersPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('purchase_orders')
    .select('*, projects(name, companies(name)), suppliers(name)')
    .order('issue_date', { ascending: false })
  return <PurchaseOrderList initialOrders={data ?? []} />
}
