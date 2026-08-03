import { NextRequest, NextResponse } from 'next/server'

// 型式検索(三菱・東芝)の商品画像だけを中継する。任意のURLを中継するとSSRFの
// 踏み台になり得るため、検索結果として想定されるホストのみ許可する
const ALLOWED_HOSTS = ['www.mitsubishielectric.co.jp', 'saturn.tlt.co.jp']

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url')
  if (!target) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.includes(url.hostname)) {
    return NextResponse.json({ error: 'host not allowed' }, { status: 400 })
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ratec-kinntai/1.0)' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' } })
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
  }
}
