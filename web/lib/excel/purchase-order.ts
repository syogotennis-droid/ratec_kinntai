import { DocumentItem, Settings } from '@/lib/supabase/types'
import { PURCHASE_ORDER_TEMPLATE_B64 } from './purchase-order-template-b64'

export interface PurchaseOrderExcelData {
  docNo: string
  issueDate: string
  supplierName: string
  projectName: string
  notes: string
  items: Omit<DocumentItem, 'id'>[]
  settings: Settings | null
}

const ITEM_START_ROW = 22
const MAX_ITEMS = 10

function dateToExcelSerial(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000
}

export async function downloadPurchaseOrderExcel(data: PurchaseOrderExcelData) {
  const XLSX = await import('xlsx')

  const templateBytes = Uint8Array.from(atob(PURCHASE_ORDER_TEMPLATE_B64), c => c.charCodeAt(0))
  const wb = XLSX.read(templateBytes, { type: 'array', cellStyles: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // Write string to a cell, preserving existing style
  const ws_str = (addr: string, v: string) => {
    const existing = ws[addr] || {}
    ws[addr] = { ...existing, v, t: 's', w: undefined, f: undefined }
  }

  // Write number to a cell, preserving existing style
  const ws_num = (addr: string, v: number) => {
    const existing = ws[addr] || {}
    ws[addr] = { ...existing, v, t: 'n', w: undefined, f: undefined }
  }

  // Write only if value is non-empty (keeps template default when no data)
  const ws_str_if = (addr: string, v: string | null | undefined) => {
    if (v) ws_str(addr, v)
  }

  // Doc number
  ws_str(addr('L', 3), data.docNo)

  // Date (replace TODAY() formula with actual date)
  const dateCell = ws[addr('J', 6)] || {}
  ws[addr('J', 6)] = { ...dateCell, v: dateToExcelSerial(data.issueDate), t: 'n', z: 'yyyy/m/d', w: undefined, f: undefined }

  // Supplier (left side)
  ws_str_if(addr('A', 8), data.supplierName ? data.supplierName + '　　御中' : null)

  // Our company info (right side) - only write if settings has values
  const st = data.settings
  if (st) {
    ws_str_if(addr('J', 9), st.company_name)
    ws_str_if(addr('J', 10), st.company_postal ? '〒' + st.company_postal : null)
    ws_str_if(addr('J', 11), st.company_address)
    ws_str_if(addr('K', 13), st.company_tel)
    ws_str_if(addr('K', 14), st.company_fax)
  }

  // Clear delivery date cell (had weird time format in template)
  ws_str(addr('B', 14), '')

  // Clear item rows (preserve style)
  for (let r = 0; r < MAX_ITEMS; r++) {
    const row = ITEM_START_ROW + r
    ws_str(addr('A', row), '')
    ws_str(addr('B', row), '')
    ws_str(addr('H', row), '')
    ws_str(addr('I', row), '')
    ws_str(addr('J', row), '')
  }

  // Write items
  const limitedItems = data.items.slice(0, MAX_ITEMS)
  for (let i = 0; i < limitedItems.length; i++) {
    const row = ITEM_START_ROW + i
    const item = limitedItems[i]
    ws_num(addr('A', row), i + 1)
    ws_str(addr('B', row), item.spec ? item.name + '　' + item.spec : item.name)
    ws_num(addr('H', row), item.qty)
    if (item.unit_price !== 0) {
      ws_num(addr('I', row), item.unit_price)
      const amtCell = ws[addr('J', row)] || {}
      ws[addr('J', row)] = { ...amtCell, v: item.qty * item.unit_price, t: 'n', w: undefined }
    }
  }

  // Project name
  ws_str(addr('A', 35), '案件名：' + data.projectName)

  // Notes row
  ws_str(addr('A', 37), data.notes ? '備考：' + data.notes : '備考：')
  ws_str(addr('A', 38), '')

  const wbout = XLSX.write(wb, { bookType: 'xls', type: 'array', cellStyles: true })
  const blob = new Blob([wbout], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `注文書_${data.docNo || '未設定'}_${data.issueDate}.xls`
  a.click()
  URL.revokeObjectURL(url)
}

function addr(col: string, row: number): string {
  return col + row
}
