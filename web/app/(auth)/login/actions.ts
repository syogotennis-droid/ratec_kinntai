'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(employeeId: string, password: string) {
  const supabase = await createClient()
  const email = `${employeeId}@ratec.local`

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: '社員番号またはパスワードが正しくありません' }
  }

  redirect('/')
}
