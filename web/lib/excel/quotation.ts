import type ExcelJS from 'exceljs'
import { QuotationItem, Settings } from '@/lib/supabase/types'
import { QUOTATION_TEMPLATE_B64 } from './template-b64'

interface QuotationExcelItem extends Omit<QuotationItem, 'id'> {
  /** 商品資料に埋め込む写真の取得先URL(署名付きURL、または未保存ならローカルのblob URL) */
  beforePhotoUrl?: string | null
  proposedPhotoUrl?: string | null
}

interface QuotationExcelData {
  docNo: string
  issueDate: string
  customerName: string
  projectName: string
  contactPerson: string | null
  notes: string
  items: QuotationExcelItem[]
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
  // テンプレートは12/13行目（サンプル行）のみ A/C/D/F の数式が組み込まれており、
  // 14行目以降は E/I/J/K/L/N/O/P/R しか用意されていないため、C/D/F は毎回明示的に書き込む。
  // 品目種別が「作業」の場合はメーカー希望小売価格の仕組みを使わず、Dに価格を直接入力する。
  const maxItems = Math.min(data.items.length, MAX_ITEMS)
  for (let i = 0; i < MAX_ITEMS; i++) {
    const evenRow = ITEM_START_ROW + i * 2
    const item = i < maxItems ? data.items[i] : null
    const isLabor = item?.item_type === 'labor'

    const nameCell = ws.getCell(`A${evenRow}`)
    nameCell.value = item ? item.name : null
    nameCell.alignment = { ...nameCell.alignment, wrapText: true }

    ws.getCell(`G${evenRow}`).value = item?.spec || null
    ws.getCell(`I${evenRow}`).value = item ? item.qty : 0

    if (isLabor) {
      // 作業行: メーカー希望小売価格・掛け率チェーンを使わず、仕切り価格(D)に直接価格を入れる
      ws.getCell(`C${evenRow}`).value = null
      ws.getCell(`D${evenRow}`).value = item ? item.unit_price : null
      ws.getCell(`H${evenRow}`).value = 0
      ws.getCell(`J${evenRow}`).value = 0
      ws.getCell(`N${evenRow}`).value = 0
    } else {
      ws.getCell(`C${evenRow}`).value = item ? { formula: `H${evenRow}` } : null
      ws.getCell(`D${evenRow}`).value = item ? { formula: `K${evenRow}` } : null
      ws.getCell(`H${evenRow}`).value = item ? item.unit_price : 0
      ws.getCell(`J${evenRow}`).value = item ? Math.round(item.markup_rate * 100 * 100) / 100 : 0
      ws.getCell(`N${evenRow}`).value = item ? Math.round(item.purchase_rate * 100 * 100) / 100 : 0
    }

    ws.getCell(`F${evenRow}`).value = item ? { formula: `D${evenRow}*E${evenRow}` } : null
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

  // 商品資料シート（チェックが付いた明細行だけを対象に、施工前写真とご提案商品写真を並べる）
  const productSheetItems = data.items.filter(i => i.has_product_sheet)
  if (productSheetItems.length > 0) {
    await addProductSheet(wb, productSheetItems, data.projectName)
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

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

// blob URL・署名付きURLには拡張子が付いていないことが多いため、URL文字列ではなく
// 実データの先頭バイト(マジックナンバー)から画像形式を判定する
function detectImageExtension(buf: ArrayBuffer): 'png' | 'jpeg' {
  const bytes = new Uint8Array(buf.slice(0, 8))
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  return isPng ? 'png' : 'jpeg'
}

// ①②③...⑳ (それ以降は "(21)" のような表記にフォールバック)
function circledNumber(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`
}

const ITEMS_PER_ROW = 4
const BLOCK_COLS = 10 // 施工前写真5列 + ご提案商品5列
const PHOTO_ROWS = 21
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
}

function mergeLabelCell(
  sheet: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, value: string,
  font: Partial<ExcelJS.Font>,
) {
  sheet.mergeCells(r1, c1, r2, c2)
  const cell = sheet.getCell(r1, c1)
  cell.value = value
  cell.font = { name: 'ＭＳ Ｐゴシック', size: 14, ...font }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) sheet.getCell(r, c).border = THIN_BORDER
  }
}

// 商品資料シート: 元々ユーザーが手作業で作っていた提案資料(①②③…と番号を振り、
// 施工前写真とご提案商品を4件ずつ横に並べるグリッド)を再現する
async function addProductSheet(wb: ExcelJS.Workbook, items: QuotationExcelItem[], projectName: string) {
  const sheet = wb.addWorksheet('商品資料')
  const totalCols = ITEMS_PER_ROW * BLOCK_COLS
  // 列幅は明示的に指定せず、元の見本と同じくExcelの既定幅のままにする

  sheet.pageSetup = {
    ...sheet.pageSetup,
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3, ...sheet.pageSetup.margins },
  }

  sheet.mergeCells(1, 1, 3, totalCols)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `${projectName ? projectName + '　' : ''}ご提案資料`
  titleCell.font = { name: 'ＭＳ Ｐゴシック', size: 20, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  for (let r = 1; r <= 4; r++) sheet.getRow(r).height = 12

  let row = 5
  for (let batchStart = 0; batchStart < items.length; batchStart += ITEMS_PER_ROW) {
    const batch = items.slice(batchStart, batchStart + ITEMS_PER_ROW)
    // 見出し行(施工前写真／ご提案商品)だけ少し高く、それ以外は元の見本と同じ12ptに揃える
    sheet.getRow(row).height = 20.25
    sheet.getRow(row + 1).height = 20.25
    for (let r = row + 2; r <= row + 5 + PHOTO_ROWS; r++) sheet.getRow(r).height = 12

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]
      const num = batchStart + i + 1
      const beforeCol = i * BLOCK_COLS + 1
      const proposedCol = beforeCol + 5

      mergeLabelCell(sheet, row, beforeCol, row + 1, beforeCol + 4, '施工前写真', {})
      mergeLabelCell(sheet, row, proposedCol, row + 1, proposedCol + 4, 'ご提案商品', {})

      mergeLabelCell(sheet, row + 2, beforeCol, row + 3, beforeCol + 4, '既設商品', { name: 'HGP創英角ｺﾞｼｯｸUB', bold: true })
      mergeLabelCell(sheet, row + 2, proposedCol, row + 3, proposedCol + 4, `ご提案商品${circledNumber(num)}`, { name: 'HGP創英角ｺﾞｼｯｸUB', bold: true })

      mergeLabelCell(sheet, row + 4, beforeCol, row + 5, beforeCol + 4, item.existing_product_name || '-', {})
      mergeLabelCell(sheet, row + 4, proposedCol, row + 5, proposedCol + 4, item.name.replace(/\n/g, ' '), {})

      const photoRowStart = row + 6
      const photoRowEnd = photoRowStart + PHOTO_ROWS - 1
      mergeLabelCell(sheet, photoRowStart, beforeCol, photoRowEnd, beforeCol + 4, '', {})
      mergeLabelCell(sheet, photoRowStart, proposedCol, photoRowEnd, proposedCol + 4, '', {})

      if (item.beforePhotoUrl) await embedProductPhoto(wb, sheet, item.beforePhotoUrl, photoRowStart - 1, beforeCol - 1)
      if (item.proposedPhotoUrl) await embedProductPhoto(wb, sheet, item.proposedPhotoUrl, photoRowStart - 1, proposedCol - 1)
    }

    row += 6 + PHOTO_ROWS
  }

  sheet.pageSetup.printArea = `A1:${sheet.getColumn(totalCols).letter}${row - 1}`
}

async function embedProductPhoto(wb: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, url: string, anchorRow: number, anchorCol: number) {
  const buf = await fetchImageBuffer(url)
  if (!buf) return
  const imageId = wb.addImage({ buffer: buf, extension: detectImageExtension(buf) })
  sheet.addImage(imageId, {
    tl: { col: anchorCol + 0.2, row: anchorRow + 0.2 },
    ext: { width: 260, height: 300 },
  })
}
