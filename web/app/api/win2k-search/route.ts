import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Win2kResult } from '@/lib/win2k'
import { toHalfWidth } from '@/lib/halfwidth'

const FILLER_WORDS = ['一体形', 'ユニット形']

function simplifyCategoryName(text: string): string {
  let s = text.replace(/[（(][^）)]*[）)]/g, '') // 括弧書きの注記を除去
  for (const w of FILLER_WORDS) s = s.split(w).join('')
  return toHalfWidth(s).trim()
}

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

    // パンくず（例: LED照明器具 ＞ LED一体形ベースライト(一般用途) ＞ スクエアライト）の
    // 先頭の大分類と末尾のサブタイプ（形状と重複しがち）を除き、シリーズ名の部分だけを
    // 商品名代わりに使う（三菱の検索結果には型番以外の商品名が無いため）
    const breadcrumb = $el.find('.r-box .subTitle').text().replace(/\s+/g, ' ').trim().split('＞').map(s => s.trim()).filter(Boolean)
    const category = simplifyCategoryName(breadcrumb.length > 1 ? breadcrumb[1] : breadcrumb[0] ?? '')

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
