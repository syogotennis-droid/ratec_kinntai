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
