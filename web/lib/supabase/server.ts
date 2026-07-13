import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const cookieConfig = {
    getAll() { return cookieStore.getAll() },
    setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        )
      } catch {}
    },
  }

  // セッションからaccess_tokenを取得してPostgRESTのAuthorizationヘッダーに明示的に渡す
  const tempClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieConfig }
  )
  const { data: { session } } = await tempClient.auth.getSession()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: session?.access_token
        ? { headers: { Authorization: `Bearer ${session.access_token}` } }
        : undefined,
      cookies: cookieConfig,
    }
  )
}
