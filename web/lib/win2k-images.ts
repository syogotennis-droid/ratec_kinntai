import type { CheerioAPI } from 'cheerio'

// 商品詳細ページには主画像・小組画像など複数の商品写真が載っているが、サイトごとに
// クラス名が違い不安定なため、「画像ファイル名に型番が含まれる」という共通パターンで
// 商品写真だけを判定する(ロゴ・アイコンなど型番と無関係な画像を除外できる)
export function extractCodeImages($: CheerioAPI, baseUrl: string, code: string): string[] {
  const normalizedCode = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  if (!normalizedCode) return []

  const urls = new Set<string>()
  $('img').each((_, el) => {
    const src = $(el).attr('src')
    if (!src) return
    const normalizedSrc = src.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    if (!normalizedSrc.includes(normalizedCode)) return
    try {
      urls.add(new URL(src, baseUrl).toString())
    } catch {
      // 相対URLとして解決できない場合は無視する
    }
  })
  return [...urls].slice(0, 6)
}

// 同じ写真がサムネイル用・拡大用など複数サイズのURLで別々に載っていることがあり、
// URL文字列だけでは重複を判定できないため、実際のファイルサイズ(Content-Length)が
// 一致するものは同一画像とみなして片方だけ残す
export async function dedupeBySize(urls: string[]): Promise<string[]> {
  const sizes = await Promise.all(urls.map(async url => {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      const len = res.headers.get('content-length')
      return len ? Number(len) : null
    } catch {
      return null
    }
  }))

  const seen = new Set<number>()
  const result: string[] = []
  urls.forEach((url, i) => {
    const size = sizes[i]
    if (size == null) { result.push(url); return }
    if (seen.has(size)) return
    seen.add(size)
    result.push(url)
  })
  return result
}
