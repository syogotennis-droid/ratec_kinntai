import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Win2kResult } from '@/lib/win2k'

export async function GET(request: NextRequest) {
  const kwd = request.nextUrl.searchParams.get('kwd')?.trim()
  if (!kwd) return NextResponse.json({ results: [] })

  const searchUrl = `https://www.mitsubishielectric.co.jp/ldg/wink/ssl/sp/searchProduct.do?kwd=${encodeURIComponent(kwd)}`

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

  $('.itemBox').each((_, el) => {
    const $el = $(el)
    const code = $el.find('.r-box .title a').text().replace(/\s+/g, ' ').trim()
    if (!code) return

    const category = $el.find('.r-box .subTitle').text().replace(/\s+/g, ' ').replace(/\s*＞\s*/g, ' > ').trim()

    const specText = $el.find('.b-box .spec').text()
    const priceMatch = specText.match(/価格[：:]\s*([\d,]+)\s*円/)
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null

    const imgSrc = $el.find('.img img').attr('src') || null
    const href = $el.find('.r-box .title a').attr('href') || null
    const detailUrl = href ? new URL(href, 'https://www.mitsubishielectric.co.jp').toString() : null

    results.push({ code, category, price, imageUrl: imgSrc, detailUrl })
  })

  return NextResponse.json({ results: results.slice(0, 20) })
}
