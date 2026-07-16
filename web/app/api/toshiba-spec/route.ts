import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Win2kSpecSummary } from '@/lib/win2k'
import { toHalfWidth } from '@/lib/halfwidth'

const SIZE_KEYS = ['埋め込みサイズ', '埋込穴', '取付穴', '器具幅', '器具径']
const WATTAGE_KEY_PREFIX = '定格消費電力'
const PRODUCT_TYPE_KEYS = ['品種名', '品名']

export async function GET(request: NextRequest) {
  const detailUrl = request.nextUrl.searchParams.get('detailUrl')
  if (!detailUrl) return NextResponse.json({ spec: null })

  let html: string
  try {
    const res = await fetch(detailUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ratec-kinntai/1.0)' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ spec: null })
    html = await res.text()
  } catch {
    return NextResponse.json({ spec: null }, { status: 502 })
  }

  const $ = cheerio.load(html)
  const table: Record<string, string> = {}
  $('table.tbl2 tr').each((_, tr) => {
    const th = $(tr).find('th').text().replace(/\s+/g, ' ').trim()
    const td = $(tr).find('td').text().replace(/\s+/g, ' ').trim()
    if (th) table[th] = td
  })

  const sizeKey = SIZE_KEYS.find(k => k in table)
  const sizeRaw = sizeKey ? table[sizeKey] : null
  const sizeMatch = sizeRaw?.match(/([φΦ])\s*:?\s*([\d.]+)/)
  const size = sizeMatch ? `${sizeMatch[1]}${sizeMatch[2]}` : null
  const shapeWord = sizeRaw?.trimStart().startsWith('□') ? 'ｽｸｴｱ' : null

  const wattageKey = Object.keys(table).find(k => k.startsWith(WATTAGE_KEY_PREFIX))
  const wattageRaw = wattageKey ? table[wattageKey] : null
  const wattageMatch = wattageRaw?.match(/([\d.]+)\s*W/)
  const wattage = wattageMatch ? wattageMatch[1] : null

  const productTypeKey = PRODUCT_TYPE_KEYS.find(k => k in table)
  const productType = productTypeKey ? toHalfWidth(table[productTypeKey]) : null

  const spec: Win2kSpecSummary = { size, shapeWord, wattage, productType }
  return NextResponse.json({ spec })
}
