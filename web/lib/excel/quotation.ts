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
  // last day of the month 3 months after issue date
  const expiry = new Date(parts[0], parts[1] + 3, 0)
  const reiwaYear = expiry.getFullYear() - 2018
  return `※本見積書有効期限　令和${reiwaYear}年${expiry.getMonth() + 1}月末日迄`
}

export async function downloadQuotationExcel(data: QuotationExcelData) {
  const ExcelJSModule = await import('exceljs')
  const wb = new ExcelJSModule.default.Workbook()

  const binary = atob(QUOTATION_TEMPLATE_B64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  await wb.xlsx.load(bytes.buffer)

  const ws = wb.getWorksheet('見積り')
  if (!ws) {
    const names = wb.worksheets.map(s => s.name).join(', ')
    throw new Error(`シートが見つかりません。存在するシート: ${names}`)
  }

  // 宛先 (A1 master of A1:C2 merge)
  ws.getCell('A1').value = data.customerName ? `${data.customerName}　御中` : ''

  // 担当者 (A3 master of A3:C4 merge)
  ws.getCell('A3').value = data.contactPerson ? `ご担当　　　${data.contactPerson}　　　様` : ''

  // 日付 (G3) - 令和年月日
  ws.getCell('G3').value = data.issueDate ? toJapaneseDate(data.issueDate) : ''

  // 工事名 (A9)
  ws.getCell('A9').value = `【工事名】　${data.projectName ?? ''}`

  // 明細行クリア (A-F columns, rows 12-37)
  // Even rows: A, C, D, E, F are masters of 2-row merges
  // Odd rows: A is master of 1-row A:B merge
  for (let row = ITEM_START_ROW; row <= 37; row++) {
    ws.getCell(`A${row}`).value = null
    ws.getCell(`C${row}`).value = null
    ws.getCell(`D${row}`).value = null
    ws.getCell(`E${row}`).value = null
    ws.getCell(`F${row}`).value = null
    ws.getCell(`G${row}`).value = null
  }

  // 明細入力 (each item occupies one pair of rows: even=data, odd=empty)
  const maxItems = Math.min(data.items.length, MAX_ITEMS)
  for (let i = 0; i < maxItems; i++) {
    const item = data.items[i]
    const masterRow = ITEM_START_ROW + i * 2

    ws.getCell(`A${masterRow}`).value = item.spec ? `${item.name}　${item.spec}` : item.name
    ws.getCell(`D${masterRow}`).value = item.unit_price
    ws.getCell(`E${masterRow}`).value = item.qty
    ws.getCell(`F${masterRow}`).value = { formula: `D${masterRow}*E${masterRow}`, result: item.amount }
  }

  // 小計・消費税・合計 (preserve formulas, update cached results)
  ws.getCell('F38').value = { formula: 'SUM(F12:F37)', result: data.subtotal }
  ws.getCell('F39').value = { formula: 'F38*0.1', result: data.taxAmount }
  ws.getCell('F40').value = { formula: 'SUM(F38:F39)', result: data.totalAmount }

  // 有効期限 (A41)
  ws.getCell('A41').value = data.issueDate ? expiryDateStr(data.issueDate) : ''

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `見積書_${data.docNo}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
