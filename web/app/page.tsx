import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[Home] user:', user?.id ?? 'null', 'authError:', authError?.message ?? 'none')

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  console.log('[Home] profile:', JSON.stringify(profile), 'profileError:', profileError?.message ?? 'none')

  if (profile?.is_admin) {
    redirect('/attendance/admin/work-list')
  } else {
    redirect('/attendance/calendar')
  }
}
