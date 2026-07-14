import { DocumentItem } from '@/lib/supabase/types'
import { PURCHASE_ORDER_TEMPLATE_B64 } from './purchase-order-template-b64'

export interface PurchaseOrderExcelData {
  docNo: string
  issueDate: string
  supplierName: string
  projectName: string
  notes: string
  items: Omit<DocumentItem, 'id'>[]
}

const ITEM_START_ROW = 22
const MAX_ITEMS = 10

function dateToExcelSerial(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000
}

// Write string to cell, preserving existing style
function setStr(ws: Record<string, any>, addr: string, v: string) {
  ws[addr] = { ...(ws[addr] || {}), v, t: 's', w: undefined, f: undefined }
}

// Write number to cell, preserving existing style
function setNum(ws: Record<string, any>, addr: string, v: number) {
  ws[addr] = { ...(ws[addr] || {}), v, t: 'n', w: undefined, f: undefined }
}

export async function downloadPurchaseOrderExcel(data: PurchaseOrderExcelData) {
  const XLSX = await import('xlsx')

  const templateBytes = Uint8Array.from(atob(PURCHASE_ORDER_TEMPLATE_B64), c => c.charCodeAt(0))
  const wb = XLSX.read(templateBytes, { type: 'array', cellStyles: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // 注文書番号
  setStr(ws, 'L3', data.docNo)

  // 日付 (TODAY()式を実際の日付に置き換え)
  ws['J6'] = { ...(ws['J6'] || {}), v: dateToExcelSerial(data.issueDate), t: 'n', z: 'yyyy/m/d', w: undefined, f: undefined }

  // 仕入先（宛先）- 未選択なら空にする
  setStr(ws, 'A8', data.supplierName ? data.supplierName + '　　御中' : '')

  // 納期日欄の元データをクリア（変な時間表示を防ぐ）
  setStr(ws, 'B14', '')

  // 明細をいったんクリア
  for (let r = 0; r < MAX_ITEMS; r++) {
    const row = ITEM_START_ROW + r
    setStr(ws, 'A' + row, '')
    setStr(ws, 'B' + row, '')
    setStr(ws, 'H' + row, '')
    setStr(ws, 'I' + row, '')
    setStr(ws, 'J' + row, '')
  }

  // 明細を書き込む
  const limitedItems = data.items.slice(0, MAX_ITEMS)
  for (let i = 0; i < limitedItems.length; i++) {
    const row = ITEM_START_ROW + i
    const item = limitedItems[i]
    setNum(ws, 'A' + row, i + 1)
    setStr(ws, 'B' + row, item.spec ? item.name + '　' + item.spec : item.name)
    setNum(ws, 'H' + row, item.qty)
    if (item.unit_price !== 0) {
      setNum(ws, 'I' + row, item.unit_price)
      ws['J' + row] = { ...(ws['J' + row] || {}), v: item.qty * item.unit_price, t: 'n', w: undefined, f: undefined }
    }
  }

  // 工事名
  setStr(ws, 'A35', '案件名：' + data.projectName)

  // 備考
  setStr(ws, 'A37', data.notes ? '備考：' + data.notes : '備考：')
  setStr(ws, 'A38', '')

  const wbout = XLSX.write(wb, { bookType: 'xls', type: 'array', cellStyles: true })
  const blob = new Blob([wbout], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `注文書_${data.docNo || '未設定'}_${data.issueDate}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
