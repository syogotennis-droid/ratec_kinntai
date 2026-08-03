import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Win2kSpecSummary } from '@/lib/win2k'
import { extractCodeImages, dedupeBySize } from '@/lib/win2k-images'

const SIZE_KEYS = ['埋込穴', '取付穴', '器具径']
const WATTAGE_KEY_PREFIX = '定格消費電力'

export async function GET(request: NextRequest) {
  const detailUrl = request.nextUrl.searchParams.get('detailUrl')
  const code = request.nextUrl.searchParams.get('code') ?? ''
  if (!detailUrl) return NextResponse.json({ spec: null, images: [] })

  let ccd: string | null = null
  let pid: string | null = null
  try {
    const u = new URL(detailUrl)
    ccd = u.searchParams.get('ccd')
    pid = u.searchParams.get('pid')
  } catch {
    return NextResponse.json({ spec: null, images: [] })
  }
  if (!ccd || !pid) return NextResponse.json({ spec: null, images: [] })

  const specUrl = `https://www.mitsubishielectric.co.jp/ldg/wink/ssl/sp/displayProductSpec.do?spid=&pid=${encodeURIComponent(pid)}&ccd=${encodeURIComponent(ccd)}`
  const fetchHtml = async (url: string) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ratec-kinntai/1.0)' },
        cache: 'no-store',
      })
      return res.ok ? await res.text() : null
    } catch {
      return null
    }
  }

  const [specHtml, detailHtml] = await Promise.all([fetchHtml(specUrl), fetchHtml(detailUrl)])
  if (!specHtml && !detailHtml) return NextResponse.json({ spec: null, images: [] }, { status: 502 })

  const table: Record<string, string> = {}
  const images = new Set<string>()

  if (specHtml) {
    const $spec = cheerio.load(specHtml)
    $spec('table.tableFormat01 tr').each((_, tr) => {
      const th = $spec(tr).find('th').text().replace(/\s+/g, ' ').trim()
      const td = $spec(tr).find('td').text().replace(/\s+/g, ' ').trim()
      if (th) table[th] = td
    })
    if (code) extractCodeImages($spec, specUrl, code).forEach(u => images.add(u))
  }
  if (detailHtml && code) {
    const $detail = cheerio.load(detailHtml)
    extractCodeImages($detail, detailUrl, code).forEach(u => images.add(u))
  }

  const sizeKey = SIZE_KEYS.find(k => k in table)
  const sizeValue = sizeKey ? table[sizeKey] : null
  const shapeWord = sizeValue?.startsWith('□') ? 'ｽｸｴｱ' : null

  const wattageKey = Object.keys(table).find(k => k.startsWith(WATTAGE_KEY_PREFIX))
  const wattageRaw = wattageKey ? table[wattageKey] : null
  const wattageMatch = wattageRaw?.match(/[\d.]+/)
  const wattage = wattageMatch ? wattageMatch[0] : null

  const spec: Win2kSpecSummary = { size: sizeValue, shapeWord, wattage }
  const rawImages = [...images].slice(0, 6)
  const dedupedImages = rawImages.length > 1 ? await dedupeBySize(rawImages) : rawImages
  return NextResponse.json({ spec, images: dedupedImages })
}
