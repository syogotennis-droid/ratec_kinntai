import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const allCookies = cookieStore.getAll()
  const authCookieNames = allCookies.filter(c => c.name.includes('sb-')).map(c => c.name)
  console.warn('[DIAG] createClient cookies:', JSON.stringify(authCookieNames))

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
  console.warn('[DIAG] getSession:', session ? `OK uid=${session.user.id} tok=${session.access_token.slice(0, 15)}...` : 'NULL', sessionError?.message ?? '')

  return client
}
