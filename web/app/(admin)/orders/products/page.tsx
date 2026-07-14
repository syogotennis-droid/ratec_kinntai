import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').order('code')
  return <ProductsClient initialProducts={data ?? []} />
}
