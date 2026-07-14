import { createClient } from '@/lib/supabase/server'
import CompaniesClient from './CompaniesClient'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('*').order('name')
  return <CompaniesClient initialCompanies={data ?? []} />
}
