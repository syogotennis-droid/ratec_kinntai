import { NextRequest, NextResponse } from 'next/server'

// 型式検索(三菱・東芝)の商品画像だけを中継する。任意のURLを中継するとSSRFの
// 踏み台になり得るため、検索結果として想定されるホストのみ許可する。
// 画像はCDN等の別サブドメインから配信されることがあるため、サブドメイン単位で許可する
const ALLOWED_DOMAINS = ['mitsubishielectric.co.jp', 'tlt.co.jp', 'yrstrade.com']

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url')
  if (!target) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }
  if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 })
  }

  try {
    const res = await fetch(url.toString(), {
      // ホットリンク対策でRefererを見るサイトがあるため、画像自身のオリジンを付けて取得する
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ratec-kinntai/1.0)', 'Referer': url.origin + '/' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ error: 'fetch failed', status: res.status }, { status: 502 })
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' } })
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed', message: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
