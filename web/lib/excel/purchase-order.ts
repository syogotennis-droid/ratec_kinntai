import { DocumentItem } from '@/lib/supabase/types'
import { PURCHASE_ORDER_TEMPLATE_B64 } from './purchase-order-template-b64'

export interface PurchaseOrderExcelData {
  docNo: string
  issueDate: string
  supplierName: string
  projectName: string
  notes: string
  items: Omit<DocumentItem, 'id'>[]
  staffName?: string
}

const ITEM_START_ROW = 22
const MAX_ITEMS = 10

function dateToExcelSerial(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000
}

export async function downloadPurchaseOrderExcel(data: PurchaseOrderExcelData) {
  const ExcelJSModule = await import('exceljs')
  const wb = new ExcelJSModule.default.Workbook()

  const templateBytes = Uint8Array.from(atob(PURCHASE_ORDER_TEMPLATE_B64), c => c.charCodeAt(0))
  await wb.xlsx.load(templateBytes.buffer)

  const ws = wb.getWorksheet(1)!

  // 注文書番号
  ws.getCell('L3').value = data.docNo

  // 日付
  ws.getCell('J6').value = dateToExcelSerial(data.issueDate)
  ws.getCell('J6').numFmt = 'yyyy/m/d'

  // 仕入先（宛先）
  ws.getCell('A8').value = data.supplierName ? data.supplierName + '　　御中' : ''

  // 担当者名
  if (data.staffName) ws.getCell('L18').value = data.staffName

  // 納期日欄クリア
  ws.getCell('B14').value = null

  // 明細クリア
  for (let r = 0; r < MAX_ITEMS; r++) {
    const row = ITEM_START_ROW + r
    ws.getCell(`A${row}`).value = null
    ws.getCell(`B${row}`).value = null
    ws.getCell(`H${row}`).value = null
    ws.getCell(`I${row}`).value = null
    ws.getCell(`J${row}`).value = null
  }

  // 明細書き込み
  const limited = data.items.slice(0, MAX_ITEMS)
  for (let i = 0; i < limited.length; i++) {
    const row = ITEM_START_ROW + i
    const item = limited[i]
    ws.getCell(`A${row}`).value = i + 1
    ws.getCell(`B${row}`).value = item.name
    ws.getCell(`H${row}`).value = item.qty
    if (item.unit_price !== 0) {
      ws.getCell(`I${row}`).value = item.unit_price
      ws.getCell(`J${row}`).value = item.qty * item.unit_price
    }
  }

  // 工事名
  ws.getCell('A35').value = '案件名：' + data.projectName

  // 備考
  ws.getCell('A37').value = data.notes ? '備考：' + data.notes : '備考：'
  ws.getCell('A38').value = null

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `注文書_${data.docNo || '未設定'}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
