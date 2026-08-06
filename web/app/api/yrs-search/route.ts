import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Win2kResult } from '@/lib/win2k'

export async function GET(request: NextRequest) {
  const kwd = request.nextUrl.searchParams.get('kwd')?.trim()
  if (!kwd) return NextResponse.json({ results: [] })

  const searchUrl = `https://www.yrstrade.com/products/?keyword=${encodeURIComponent(kwd)}`

  let html: string
  try {
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ratec-kinntai/1.0)' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ results: [] })
    html = await res.text()
  } catch {
    return NextResponse.json({ results: [] }, { status: 502 })
  }

  const $ = cheerio.load(html)
  const results: Win2kResult[] = []

  // ユアーズ・トレードの検索結果には希望小売価格の記載が無いため price は常にnull
  $('ul.works-list > li').each((_, el) => {
    const $el = $(el)
    const $link = $el.find('a').first()

    const code = $link.find('.s-ttl').text().replace(/^\s*品番[：:]\s*/, '').replace(/\s+/g, ' ').trim()
    if (!code) return

    // 品名(.ttl)の方が種別(.type)より情報量が多いため、品名代わりに使う
    const category = $link.find('.ttl').text().replace(/\s+/g, ' ').trim()

    const imgSrc = $link.find('img').attr('src') || null
    const imageUrl = imgSrc ? new URL(imgSrc, 'https://www.yrstrade.com/').toString() : null
    const href = $link.attr('href') || null
    const detailUrl = href ? new URL(href, 'https://www.yrstrade.com/').toString() : null

    results.push({ code, category, price: null, imageUrl, detailUrl })
  })

  return NextResponse.json({ results: results.slice(0, 20) })
}
