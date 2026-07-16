import { QuotationItem, Settings } from '@/lib/supabase/types'
import { QUOTATION_TEMPLATE_B64 } from './template-b64'

interface QuotationExcelData {
  docNo: string
  issueDate: string
  customerName: string
  projectName: string
  contactPerson: string | null
  notes: string
  items: Omit<QuotationItem, 'id'>[]
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

  // 明細入力
  // C/D/E/F/K/L/O/P/R はテンプレートに数式が組み込まれているため触らない。
  // 手入力欄の A(品名)/G(備考)/H(メーカー希望小売価格)/I(数量)/J(仕切掛け率)/N(仕入掛け率) のみ設定する。
  const maxItems = Math.min(data.items.length, MAX_ITEMS)
  for (let i = 0; i < MAX_ITEMS; i++) {
    const evenRow = ITEM_START_ROW + i * 2
    const item = i < maxItems ? data.items[i] : null

    const nameCell = ws.getCell(`A${evenRow}`)
    nameCell.value = item ? item.name : null
    nameCell.alignment = { ...nameCell.alignment, wrapText: true }

    ws.getCell(`G${evenRow}`).value = item?.spec || null
    ws.getCell(`H${evenRow}`).value = item ? item.unit_price : 0
    ws.getCell(`I${evenRow}`).value = item ? item.qty : 0
    ws.getCell(`J${evenRow}`).value = item ? Math.round(item.markup_rate * 100 * 100) / 100 : 0
    ws.getCell(`N${evenRow}`).value = item ? Math.round(item.purchase_rate * 100 * 100) / 100 : 0
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
