import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export interface Win2kSpecSummary {
  /** 埋込穴・取付穴などのサイズ表記（例: "□450"） */
  size: string | null
  /** □なら"スクエア"、φ/Φなら"丸形" */
  shapeWord: string | null
  /** 定格消費電力の数値部分（例: "33.5"） */
  wattage: string | null
}

const SIZE_KEYS = ['埋込穴', '取付穴', '器具径']
const WATTAGE_KEY_PREFIX = '定格消費電力'

export async function GET(request: NextRequest) {
  const detailUrl = request.nextUrl.searchParams.get('detailUrl')
  if (!detailUrl) return NextResponse.json({ spec: null })

  let ccd: string | null = null
  let pid: string | null = null
  try {
    const u = new URL(detailUrl)
    ccd = u.searchParams.get('ccd')
    pid = u.searchParams.get('pid')
  } catch {
    return NextResponse.json({ spec: null })
  }
  if (!ccd || !pid) return NextResponse.json({ spec: null })

  const specUrl = `https://www.mitsubishielectric.co.jp/ldg/wink/ssl/sp/displayProductSpec.do?spid=&pid=${encodeURIComponent(pid)}&ccd=${encodeURIComponent(ccd)}`

  let html: string
  try {
    const res = await fetch(specUrl, {
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
  $('table.tableFormat01 tr').each((_, tr) => {
    const th = $(tr).find('th').text().replace(/\s+/g, ' ').trim()
    const td = $(tr).find('td').text().replace(/\s+/g, ' ').trim()
    if (th) table[th] = td
  })

  const sizeKey = Object.keys(table).find(k => SIZE_KEYS.includes(k))
  const sizeValue = sizeKey ? table[sizeKey] : null
  const shapeWord = sizeValue?.startsWith('□') ? 'スクエア' : /^[φΦ]/.test(sizeValue ?? '') ? '丸形' : null

  const wattageKey = Object.keys(table).find(k => k.startsWith(WATTAGE_KEY_PREFIX))
  const wattageRaw = wattageKey ? table[wattageKey] : null
  const wattageMatch = wattageRaw?.match(/[\d.]+/)
  const wattage = wattageMatch ? wattageMatch[0] : null

  const spec: Win2kSpecSummary = { size: sizeValue, shapeWord, wattage }
  return NextResponse.json({ spec })
}
