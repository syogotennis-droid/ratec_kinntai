import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  console.warn('[DIAG] layout profile:', JSON.stringify(profile), 'err:', profileError?.message ?? 'none', 'code:', profileError?.code ?? '-')

  if (!profile) redirect('/login')

  return <AppShell profile={profile}>{children}</AppShell>
}
