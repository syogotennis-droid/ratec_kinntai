import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// sb-*-auth-token クッキー（チャンク分割対応）からセッションの有効期限を読む
function getSessionExpiry(request: NextRequest): number | null {
  const chunks = request.cookies
    .getAll()
    .filter(c => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  if (chunks.length === 0) return null

  let raw = chunks.map(c => c.value).join('')
  if (raw.startsWith('base64-')) {
    let b64 = raw.slice(7).replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    raw = atob(b64)
  }
  const session = JSON.parse(raw)
  return typeof session.expires_at === 'number' ? session.expires_at : null
}

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // トークンが十分残っていればネットワーク往復なしで素通しする。
  // 期限切れ間近・解析失敗時のみ getUser() でリフレッシュ。
  try {
    const expiresAt = getSessionExpiry(request)
    if (expiresAt === null) return supabaseResponse // 未ログイン: リダイレクトはサーバー側で処理
    const now = Math.floor(Date.now() / 1000)
    if (expiresAt - now > 300) return supabaseResponse
  } catch {}

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
