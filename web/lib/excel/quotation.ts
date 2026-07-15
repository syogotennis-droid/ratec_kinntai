import { DocumentItem, Settings } from '@/lib/supabase/types'
import { QUOTATION_TEMPLATE_B64 } from './template-b64'

interface QuotationExcelData {
  docNo: string
  issueDate: string
  customerName: string
  projectName: string
  contactPerson: string | null
  notes: string
  items: Omit<DocumentItem, 'id'>[]
  subtotal: number
  taxAmount: number
  totalAmount: number
  settings: Settings | null
  handlerName?: string
}

const ITEM_START_ROW = 12
const MAX_ITEMS = 13

function toJapaneseDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  const reiwaYear = parts[0] - 2018
  return `令和${reiwaYear}年${parts[1]}月${parts[2]}日`
}

function expiryDateStr(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  const expiry = new Date(parts[0], parts[1] + 3, 0)
  const reiwaYear = expiry.getFullYear() - 2018
  return `※本見積書有効期限　令和${reiwaYear}年${expiry.getMonth() + 1}月末日迄`
}

export async function downloadQuotationExcel(data: QuotationExcelData) {
  const [ExcelJSModule, JSZipModule] = await Promise.all([
    import('exceljs'),
    import('jszip'),
  ])
  const JSZip = JSZipModule.default

  const templateBytes = Uint8Array.from(atob(QUOTATION_TEMPLATE_B64), c => c.charCodeAt(0))

  // テンプレートから元の drawing XML を保存（画像サイズ保持用）
  const templateZip = await new JSZip().loadAsync(templateBytes)
  const originalDrawingXml = await templateZip.file('xl/drawings/drawing1.xml')?.async('string')

  const wb = new ExcelJSModule.default.Workbook()
  await wb.xlsx.load(templateBytes.buffer)

  const ws = wb.getWorksheet('見積り')
  if (!ws) {
    const names = wb.worksheets.map(s => s.name).join(', ')
    throw new Error(`シートが見つかりません。存在するシート: ${names}`)
  }

  // 宛先 (A1:C2 merged)
  ws.getCell('A1').value = data.customerName ? `${data.customerName}　御中` : ''

  // 担当者 (A3:C4 merged)
  ws.getCell('A3').value = data.contactPerson ? `ご担当　　　${data.contactPerson}　　　様` : ''

  // 日付 (G3)
  ws.getCell('G3').value = data.issueDate ? toJapaneseDate(data.issueDate) : ''

  // 工事名 (A9)
  ws.getCell('A9').value = `【工事名】　${data.projectName ?? ''}`

  // 明細行クリア (印刷範囲内 A-G + 範囲外 H-K を全行クリア)
  for (let row = ITEM_START_ROW; row <= 37; row++) {
    ws.getCell(`A${row}`).value = null
    ws.getCell(`C${row}`).value = null
    ws.getCell(`D${row}`).value = null
    ws.getCell(`E${row}`).value = null
    ws.getCell(`F${row}`).value = null
    ws.getCell(`G${row}`).value = null
    ws.getCell(`H${row}`).value = null  // 施工時間 (サンプル値・12人等をクリア)
    ws.getCell(`I${row}`).value = null  // 仕入 (入力欄)
    ws.getCell(`J${row}`).value = null
    ws.getCell(`K${row}`).value = null
  }

  // 行 12-27 の A:B マージを 1行×2セル → 2行×1セルに変換（諸経費スタイル）
  for (let r = ITEM_START_ROW; r <= 26; r += 2) {
    try { ws.unMergeCells(`A${r}:B${r}`) } catch { /* already unmerged */ }
    try { ws.unMergeCells(`A${r + 1}:B${r + 1}`) } catch { /* already unmerged */ }
    ws.mergeCells(`A${r}:B${r + 1}`)
  }

  // 明細入力 + 各行の仕入合計・粗利数式を設定
  const maxItems = Math.min(data.items.length, MAX_ITEMS)
  for (let i = 0; i < MAX_ITEMS; i++) {
    const evenRow = ITEM_START_ROW + i * 2
    const oddRow = evenRow + 1
    const item = i < maxItems ? data.items[i] : null

    // 品名・単価・数量・小計 (偶数行マスターのみ)
    if (item) {
      ws.getCell(`A${evenRow}`).value = item.name
      ws.getCell(`D${evenRow}`).value = item.unit_price
      ws.getCell(`E${evenRow}`).value = item.qty
      ws.getCell(`F${evenRow}`).value = { formula: `D${evenRow}*E${evenRow}`, result: item.amount }
    }

    // 仕入合計 (J) = 仕入単価 × 数量（偶数行マスターのみ）
    ws.getCell(`J${evenRow}`).value = { formula: `I${evenRow}*E${evenRow}`, result: 0 }

    // 粗利 (K) = 小計 - 仕入合計（偶数行マスターのみ）
    const kResult = item ? item.amount : 0
    ws.getCell(`K${evenRow}`).value = { formula: `F${evenRow}-J${evenRow}`, result: kResult }
  }

  // 小計・消費税・合計
  ws.getCell('F38').value = { formula: 'SUM(F12:F37)', result: data.subtotal }
  ws.getCell('F39').value = { formula: 'F38*0.1', result: data.taxAmount }
  ws.getCell('F40').value = { formula: 'SUM(F38:F39)', result: data.totalAmount }

  // 有効期限 (A41)
  ws.getCell('A41').value = data.issueDate ? expiryDateStr(data.issueDate) : ''

  // 担当者名 (G46)
  if (data.handlerName) {
    ws.getCell('G46').value = `担当：${data.handlerName}`
  }

  const buffer = await wb.xlsx.writeBuffer()

  // ExcelJS が書き換えた drawing XML を元に戻して画像サイズを保持
  const outputZip = await new JSZip().loadAsync(buffer)
  if (originalDrawingXml) {
    outputZip.file('xl/drawings/drawing1.xml', originalDrawingXml)
  }
  const patchedBuffer = await outputZip.generateAsync({ type: 'arraybuffer' })

  const blob = new Blob([patchedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `見積書_${data.docNo}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
