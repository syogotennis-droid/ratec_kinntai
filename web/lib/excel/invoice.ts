import { DocumentItem, Settings, Company } from '@/lib/supabase/types'
import { INVOICE_TEMPLATE_B64 } from './invoice-template-b64'

export interface InvoiceExcelData {
  docNo: string
  issueDate: string
  customerName: string
  customerPostal: string
  customerAddress: string
  notes: string
  items: Omit<DocumentItem, 'id'>[]
  discountDigits: number
  discountAmount: number
  adjustedSubtotal: number
  taxAmount: number
  totalAmount: number
  settings: Settings | null
  company: Company | null
}

const ITEM_START_ROW = 24
const MAX_ITEMS = 10

function dateToExcelSerial(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = Date.UTC(year, month - 1, day)
  const epoch = Date.UTC(1899, 11, 30)
  return (date - epoch) / 86400000
}

function fillSheet(
  ws: import('exceljs').Worksheet,
  data: InvoiceExcelData,
  postalRow: number,
  addressRef: string,
  nameRef: string,
  notesRef: string,
  isMain: boolean
) {
  // Customer postal (own cell, not cross-referenced)
  ws.getCell(`A${postalRow}`).value = data.customerPostal ? `〒${data.customerPostal}` : ''

  // Customer address and name (only write on main 請求書 sheet; 納品書 references via formula)
  if (isMain) {
    ws.getCell(addressRef).value = data.customerAddress || ''
    ws.getCell(nameRef).value = data.customerName || ''
    // Date
    ws.getCell('N5').value = data.issueDate ? dateToExcelSerial(data.issueDate) : null
  }

  // Clear item area
  const clearEnd = isMain ? 49 : 45
  for (let row = ITEM_START_ROW; row <= clearEnd; row++) {
    ws.getCell(`A${row}`).value = null
    ws.getCell(`I${row}`).value = null
    ws.getCell(`K${row}`).value = null
    ws.getCell(`M${row}`).value = null
    ws.getCell(`N${row}`).value = null
  }

  // Write items
  const limitedItems = data.items.slice(0, MAX_ITEMS)
  for (let i = 0; i < limitedItems.length; i++) {
    const evenRow = ITEM_START_ROW + i * 2
    const oddRow = evenRow + 1
    const item = limitedItems[i]
    ws.getCell(`A${evenRow}`).value = item.name
    ws.getCell(`I${evenRow}`).value = item.qty
    ws.getCell(`K${evenRow}`).value = item.unit_price
    ws.getCell(`M${evenRow}`).value = { formula: `K${evenRow}*I${evenRow}`, result: item.amount }
    ws.getCell(`M${oddRow}`).value = { formula: `K${evenRow}*I${evenRow}`, result: item.amount }
  }

  // 特別調整値引き row (after regular items)
  if (data.discountAmount !== 0) {
    const dEven = ITEM_START_ROW + limitedItems.length * 2
    const dOdd = dEven + 1
    ws.getCell(`A${dEven}`).value = '特別調整値引き'
    ws.getCell(`I${dEven}`).value = 1
    ws.getCell(`K${dEven}`).value = data.discountAmount
    ws.getCell(`M${dEven}`).value = { formula: `K${dEven}*I${dEven}`, result: data.discountAmount }
    ws.getCell(`M${dOdd}`).value = { formula: `K${dEven}*I${dEven}`, result: data.discountAmount }
  }

  // Notes
  ws.getCell(notesRef).value = data.notes || null
}

export async function downloadInvoiceExcel(data: InvoiceExcelData) {
  const [ExcelJSModule, JSZipModule] = await Promise.all([
    import('exceljs'),
    import('jszip'),
  ])
  const JSZip = JSZipModule.default

  const templateBytes = Uint8Array.from(atob(INVOICE_TEMPLATE_B64), c => c.charCodeAt(0))

  const templateZip = await new JSZip().loadAsync(templateBytes)
  const drawing1Xml = await templateZip.file('xl/drawings/drawing1.xml')?.async('string')
  const drawing2Xml = await templateZip.file('xl/drawings/drawing2.xml')?.async('string')

  const wb = new ExcelJSModule.default.Workbook()
  await wb.xlsx.load(templateBytes.buffer)

  const ws1 = wb.getWorksheet('請求書')
  if (!ws1) throw new Error('請求書シートが見つかりません')

  const ws2 = wb.getWorksheet('納品書')

  // Fill 請求書 (main sheet)
  fillSheet(ws1, data, 3, 'A4', 'A6', 'A54', true)

  // Fill 納品書 (references customer info from 請求書 via formula, but items are independent)
  if (ws2) {
    fillSheet(ws2, data, 8, 'A4', 'A6', 'A50', false)
  }

  const buffer = await wb.xlsx.writeBuffer()

  const outputZip = await new JSZip().loadAsync(buffer)
  if (drawing1Xml) outputZip.file('xl/drawings/drawing1.xml', drawing1Xml)
  if (drawing2Xml) outputZip.file('xl/drawings/drawing2.xml', drawing2Xml)
  const patchedBuffer = await outputZip.generateAsync({ type: 'arraybuffer' })

  const blob = new Blob([patchedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `請求書_${data.docNo || '未設定'}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
