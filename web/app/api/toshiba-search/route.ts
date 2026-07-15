import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Win2kResult } from '@/lib/win2k'

export async function GET(request: NextRequest) {
  const kwd = request.nextUrl.searchParams.get('kwd')?.trim()
  if (!kwd) return NextResponse.json({ results: [] })

  const params = new URLSearchParams({
    page: '0', rows: '20', sort: '-recommend', anc: 'res', rsF: '0', iesFlug: '0',
    f: 'kw', st: '', katamei: kwd, newF: '0', enProdF: '1', pubF: '0', greenF: '0',
    searchView: 'list',
  })
  const searchUrl = `https://saturn.tlt.co.jp/pdocs/product.html?${params.toString()}`

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

  $('li.sdb_tblKatamei').each((_, li) => {
    const $li = $(li)
    const $row = $li.closest('tr')
    const code = $li.find('a.title').first().text().replace(/\s+/g, ' ').trim()
    if (!code) return

    // 品名（型式の下に続くプレーンテキストの li のみ。推奨ランプ・発売日・価格改定注記などは除外）
    const $ul = $li.closest('ul')
    const nameParts: string[] = []
    $ul.children('li.mb4').each((__, nli) => {
      const $nli = $(nli)
      if ($nli.hasClass('sdb_tblKatamei') || $nli.hasClass('tcR')) return
      if ($nli.children().length > 0) return
      const t = $nli.text().replace(/\s+/g, ' ').trim()
      if (t) nameParts.push(t)
    })
    const name = nameParts.join(' ')

    // 希望小売価格（行内の最初の td.tc.w8p）。「¥6,300(¥11,200)」の器具単体価格を採用
    const priceCell = $row.find('td.tc.w8p').first()
    const m = priceCell.text().replace(/\s+/g, ' ').trim().match(/[¥￥]\s*([\d,]+)/)
    const price = m ? Number(m[1].replace(/,/g, '')) : null

    let imageUrl = $row.find('img.sdb_tblSmallpic').attr('src') || null
    if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl

    const href = $li.find('a.title').attr('href') || null
    const detailUrl = href ? new URL(href, 'https://saturn.tlt.co.jp/pdocs/').toString() : null

    results.push({ code, category: name, price, imageUrl, detailUrl })
  })

  return NextResponse.json({ results: results.slice(0, 20) })
}
