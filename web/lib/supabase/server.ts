import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // --- 診断ログ START ---
  const allCookies = cookieStore.getAll()
  const authCookies = allCookies.filter(c => c.name.includes('auth-token') || c.name.includes('sb-'))
  console.log('[createClient] total cookies:', allCookies.length, '| auth cookies:', authCookies.map(c => c.name))

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {}
        },
      },
    }
  )

  const { data: { session }, error: sessionError } = await client.auth.getSession()
  console.log('[createClient] getSession:', session ? `OK user=${session.user.id} token=${session.access_token.substring(0, 20)}...` : 'NULL', sessionError ? `err=${sessionError.message}` : '')
  // --- 診断ログ END ---

  return client
}
