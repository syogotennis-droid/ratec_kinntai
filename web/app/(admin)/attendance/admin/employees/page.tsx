import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/lib/supabase/types'
import EmployeesClient from './EmployeesClient'

export default async function EmployeesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('employee_id')
  const profiles: Profile[] = data ?? []

  return <EmployeesClient initialProfiles={profiles} />
}
