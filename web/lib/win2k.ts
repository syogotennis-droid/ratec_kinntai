export interface Win2kResult {
  code: string
  category: string
  price: number | null
  imageUrl: string | null
  detailUrl: string | null
}

/** 商品詳細ページから追加取得した仕様（サイズ・消費電力など）で品名を補強するための情報 */
export interface Win2kSpecSummary {
  /** 埋込穴・埋め込みサイズなど（例: "□450", "φ75"） */
  size: string | null
  /** □なら"ｽｸｴｱ"。丸形はΦ記号だけで通じるため付けない */
  shapeWord: string | null
  /** 定格消費電力の数値部分（例: "33.5", "4.4"） */
  wattage: string | null
  /** 品名の代わりに使う、より正確な製品タイプ名が取れた場合はここに入れる */
  productType?: string | null
}
