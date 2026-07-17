import { createClient } from '@/lib/supabase/server'
import CompaniesClient from './CompaniesClient'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('*').order('address')
  return <CompaniesClient initialCompanies={data ?? []} />
}
