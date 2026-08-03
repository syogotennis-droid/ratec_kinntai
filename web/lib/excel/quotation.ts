import type ExcelJS from 'exceljs'
import { QuotationItem, Settings } from '@/lib/supabase/types'
import { QUOTATION_TEMPLATE_B64 } from './template-b64'
import { PRODUCT_SHEET_TEMPLATE_B64 } from './product-sheet-template-b64'

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
    await addProductSheet(ExcelJSModule.default, wb, productSheetItems, data.projectName)
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

interface ProductSlot {
  headerRow: [number, number]
  subRow: [number, number]
  nameRow: [number, number]
  photoRow: [number, number]
  beforeCol: [number, number]
  proposedCol: [number, number]
}

// 元の手作りテンプレート(product-sheet-template-b64)の実際のセル座標。
// バッチ1(1〜4件目・21行の写真枠)とバッチ2(5〜7件目・22行の写真枠)は
// 元ファイルのまま微妙にサイズが異なるため、それぞれ実測値をそのまま使う
const TEMPLATE_SLOTS: ProductSlot[] = [
  { headerRow: [5, 6], subRow: [7, 8], nameRow: [9, 10], photoRow: [11, 31], beforeCol: [1, 5], proposedCol: [6, 10] },
  { headerRow: [5, 6], subRow: [7, 8], nameRow: [9, 10], photoRow: [11, 31], beforeCol: [11, 15], proposedCol: [16, 20] },
  { headerRow: [5, 6], subRow: [7, 8], nameRow: [9, 10], photoRow: [11, 31], beforeCol: [21, 25], proposedCol: [26, 30] },
  { headerRow: [5, 6], subRow: [7, 8], nameRow: [9, 10], photoRow: [11, 31], beforeCol: [31, 34], proposedCol: [35, 38] },
  { headerRow: [32, 33], subRow: [34, 35], nameRow: [36, 37], photoRow: [38, 59], beforeCol: [1, 5], proposedCol: [6, 10] },
  { headerRow: [32, 33], subRow: [34, 35], nameRow: [36, 37], photoRow: [38, 59], beforeCol: [11, 15], proposedCol: [16, 20] },
  { headerRow: [32, 33], subRow: [34, 35], nameRow: [36, 37], photoRow: [38, 59], beforeCol: [21, 25], proposedCol: [26, 30] },
]
const TEMPLATE_MAX_ROW = 59
const TEMPLATE_MAX_COL = 38
// Excelの列幅(文字数単位)→pxのおおよその換算値。このシートの既定フォント
// (ＭＳ Ｐゴシック)は一般的なCalibri基準の目安(1文字幅≒8px)よりかなり
// 狭く描画されるため、実測に基づいた値を使う
const CHAR_TO_PX = 4
const PT_TO_PX = 4 / 3

async function loadProductSheetTemplate(ExcelJSCtor: typeof ExcelJS): Promise<ExcelJS.Worksheet> {
  const bytes = Uint8Array.from(atob(PRODUCT_SHEET_TEMPLATE_B64), c => c.charCodeAt(0))
  const tmpWb = new ExcelJSCtor.Workbook()
  await tmpWb.xlsx.load(bytes.buffer as ArrayBuffer)
  const ws = tmpWb.getWorksheet('商品資料')
  if (!ws) throw new Error('商品資料テンプレートの読み込みに失敗しました')
  return ws
}

// 罫線・列幅・行の高さ・フォントなど、テンプレートの見た目をそのまま出力シートへ複製する
function copyTemplateStructure(template: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
  target.pageSetup = { ...template.pageSetup }
  for (let c = 1; c <= TEMPLATE_MAX_COL; c++) {
    const width = template.getColumn(c).width
    if (width) target.getColumn(c).width = width
  }
  for (let r = 1; r <= TEMPLATE_MAX_ROW; r++) {
    const height = template.getRow(r).height
    if (height) target.getRow(r).height = height
    for (let c = 1; c <= TEMPLATE_MAX_COL; c++) {
      const src = template.getCell(r, c)
      const dst = target.getCell(r, c)
      dst.value = src.value
      dst.style = src.style
    }
  }
  for (const range of template.model.merges) target.mergeCells(range)
}

// 未使用スロット(チェックされた明細がそこまで無い場合)はラベル・罫線ごと空にする
function clearSlot(sheet: ExcelJS.Worksheet, slot: ProductSlot) {
  for (const [r1, r2] of [slot.headerRow, slot.subRow, slot.nameRow, slot.photoRow]) {
    for (let r = r1; r <= r2; r++) {
      for (let c = slot.beforeCol[0]; c <= slot.proposedCol[1]; c++) {
        const cell = sheet.getCell(r, c)
        if (r === r1 && c === slot.beforeCol[0]) cell.value = null
        if (r === r1 && c === slot.proposedCol[0]) cell.value = null
        cell.border = {}
      }
    }
  }
}

function computeBlockPx(template: ExcelJS.Worksheet, colRange: [number, number], rowRange: [number, number]) {
  let widthUnits = 0
  for (let c = colRange[0]; c <= colRange[1]; c++) widthUnits += template.getColumn(c).width || 8.43
  let heightPt = 0
  for (let r = rowRange[0]; r <= rowRange[1]; r++) heightPt += template.getRow(r).height || 15
  return { widthPx: widthUnits * CHAR_TO_PX, heightPx: heightPt * PT_TO_PX }
}

// 商品資料シート: 元々ユーザーが手作業で作っていた提案資料ファイルをテンプレートとして
// そのまま流用し(罫線・列幅・行の高さ・フォント・印刷設定はテンプレートのものを複製)、
// 明細テキストと写真だけをコードで埋め込む
async function addProductSheet(ExcelJSCtor: typeof ExcelJS, wb: ExcelJS.Workbook, items: QuotationExcelItem[], projectName: string) {
  const template = await loadProductSheetTemplate(ExcelJSCtor)
  const sheet = wb.addWorksheet('商品資料')
  copyTemplateStructure(template, sheet)

  sheet.getCell(1, 1).value = `${projectName ? projectName + '　' : ''}ご提案資料`

  const templateItems = items.slice(0, TEMPLATE_SLOTS.length)
  let maxRowUsed = 3
  let maxColUsed = 1

  for (let i = 0; i < TEMPLATE_SLOTS.length; i++) {
    const slot = TEMPLATE_SLOTS[i]
    const item = templateItems[i]
    if (!item) {
      clearSlot(sheet, slot)
      continue
    }
    maxRowUsed = Math.max(maxRowUsed, slot.photoRow[1])
    maxColUsed = Math.max(maxColUsed, slot.proposedCol[1])

    sheet.getCell(slot.nameRow[0], slot.beforeCol[0]).value = item.existing_product_name || '-'
    sheet.getCell(slot.nameRow[0], slot.proposedCol[0]).value = item.name.replace(/\n/g, ' ')

    if (item.beforePhotoUrl) {
      const block = computeBlockPx(template, slot.beforeCol, slot.photoRow)
      await embedProductPhoto(wb, sheet, item.beforePhotoUrl, slot.photoRow[0] - 1, slot.beforeCol[0] - 1, block)
    }
    if (item.proposedPhotoUrl) {
      const block = computeBlockPx(template, slot.proposedCol, slot.photoRow)
      await embedProductPhoto(wb, sheet, item.proposedPhotoUrl, slot.photoRow[0] - 1, slot.proposedCol[0] - 1, block)
    }
  }

  // テンプレートの枠(7件分)を超えた分は簡易フォーマットで下に追記する
  const overflowItems = items.slice(TEMPLATE_SLOTS.length)
  if (overflowItems.length > 0) {
    const extra = await appendFallbackItems(wb, sheet, overflowItems, TEMPLATE_MAX_ROW + 3, TEMPLATE_SLOTS.length)
    maxRowUsed = Math.max(maxRowUsed, extra.maxRow)
    maxColUsed = Math.max(maxColUsed, extra.maxCol)
  }

  sheet.pageSetup.printArea = `A1:${sheet.getColumn(maxColUsed).letter}${maxRowUsed}`
}

async function embedProductPhoto(
  wb: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, url: string, anchorRow: number, anchorCol: number,
  block: { widthPx: number; heightPx: number },
) {
  const buf = await fetchImageBuffer(url)
  if (!buf) return
  const imageId = wb.addImage({ buffer: buf, extension: detectImageExtension(buf) })

  // 元見本は写真ごとに縦横比を保ったまま枠いっぱいに大きく配置していたため、
  // 実際の画像サイズを取得して枠に収まる最大サイズへ拡大・縮小し、中央に配置する
  let width = block.widthPx
  let height = block.heightPx
  try {
    const bitmap = await createImageBitmap(new Blob([buf]))
    const scale = Math.min(block.widthPx / bitmap.width, block.heightPx / bitmap.height)
    width = bitmap.width * scale
    height = bitmap.height * scale
    bitmap.close()
  } catch {
    // 画像サイズが取得できない場合は枠いっぱいのサイズのまま配置する
  }

  const colOff = (block.widthPx - width) / 2 / CHAR_TO_PX
  const rowOff = (block.heightPx - height) / 2 / (15 * PT_TO_PX)
  sheet.addImage(imageId, {
    tl: { col: anchorCol + colOff, row: anchorRow + rowOff },
    ext: { width, height },
  })
}

// テンプレートの7件枠を超えた分は、コードで組んだシンプルな1件ずつのブロックを追記する
const FALLBACK_BLOCK_COLS = 10
const FALLBACK_PHOTO_ROWS = 21
const FALLBACK_ITEMS_PER_ROW = 4
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

// コードで組んだフォールバックブロックの、既定列幅(8.43)・12pt行高でのおおよそのpxサイズ
const FALLBACK_BLOCK_PX = { widthPx: 5 * 8.43 * CHAR_TO_PX, heightPx: FALLBACK_PHOTO_ROWS * 12 * PT_TO_PX }

async function appendFallbackItems(wb: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, items: QuotationExcelItem[], startRow: number, numberOffset: number) {
  let row = startRow
  let maxCol = 1
  for (let batchStart = 0; batchStart < items.length; batchStart += FALLBACK_ITEMS_PER_ROW) {
    const batch = items.slice(batchStart, batchStart + FALLBACK_ITEMS_PER_ROW)
    sheet.getRow(row).height = 20.25
    sheet.getRow(row + 1).height = 20.25
    for (let r = row + 2; r <= row + 5 + FALLBACK_PHOTO_ROWS; r++) sheet.getRow(r).height = 12

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]
      const num = numberOffset + batchStart + i + 1
      const beforeCol = i * FALLBACK_BLOCK_COLS + 1
      const proposedCol = beforeCol + 5
      maxCol = Math.max(maxCol, proposedCol + 4)

      mergeLabelCell(sheet, row, beforeCol, row + 1, beforeCol + 4, '施工前写真', {})
      mergeLabelCell(sheet, row, proposedCol, row + 1, proposedCol + 4, 'ご提案商品', {})
      mergeLabelCell(sheet, row + 2, beforeCol, row + 3, beforeCol + 4, '既設商品', { name: 'HGP創英角ｺﾞｼｯｸUB', bold: true })
      mergeLabelCell(sheet, row + 2, proposedCol, row + 3, proposedCol + 4, `ご提案商品${circledNumber(num)}`, { name: 'HGP創英角ｺﾞｼｯｸUB', bold: true })
      mergeLabelCell(sheet, row + 4, beforeCol, row + 5, beforeCol + 4, item.existing_product_name || '-', {})
      mergeLabelCell(sheet, row + 4, proposedCol, row + 5, proposedCol + 4, item.name.replace(/\n/g, ' '), {})

      const photoRowStart = row + 6
      const photoRowEnd = photoRowStart + FALLBACK_PHOTO_ROWS - 1
      mergeLabelCell(sheet, photoRowStart, beforeCol, photoRowEnd, beforeCol + 4, '', {})
      mergeLabelCell(sheet, photoRowStart, proposedCol, photoRowEnd, proposedCol + 4, '', {})

      if (item.beforePhotoUrl) await embedProductPhoto(wb, sheet, item.beforePhotoUrl, photoRowStart - 1, beforeCol - 1, FALLBACK_BLOCK_PX)
      if (item.proposedPhotoUrl) await embedProductPhoto(wb, sheet, item.proposedPhotoUrl, photoRowStart - 1, proposedCol - 1, FALLBACK_BLOCK_PX)
    }
    row += 6 + FALLBACK_PHOTO_ROWS
  }
  return { maxRow: row - 1, maxCol }
}
