'use server'

import { redirect, RedirectType } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(employeeId: string, password: string) {
  const supabase = await createClient()
  const email = `${employeeId}@ratec.local`

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: '社員番号またはパスワードが正しくありません' }
  }

  // Server Actionのredirectは既定でpush(履歴に追加)されるため、ログイン画面が
  // 履歴に残り「戻る」で戻れてしまう。replaceにしてログイン画面を履歴から消す
  redirect('/', RedirectType.replace)
}
