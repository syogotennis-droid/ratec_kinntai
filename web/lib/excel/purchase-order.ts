import { DocumentItem, Settings, Supplier } from '@/lib/supabase/types'
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

  const s = (v: string) => ({ v, t: 's' as const })
  const n = (v: number) => ({ v, t: 'n' as const })

  // Doc number and date
  ws['L3'] = s(data.docNo)
  ws['J6'] = { v: dateToExcelSerial(data.issueDate), t: 'n' as const, z: 'yyyy/m/d' }

  // Supplier (left side - who we're ordering from)
  ws['A8'] = s(data.supplierName ? data.supplierName + '　　御中' : '')

  // Our company info (right side)
  if (data.settings) {
    ws['J9'] = s(data.settings.company_name)
    ws['J10'] = s(data.settings.company_postal ? '〒' + data.settings.company_postal : '')
    ws['J11'] = s(data.settings.company_address)
    ws['K13'] = s(data.settings.company_tel)
    ws['K14'] = s(data.settings.company_fax)
  }

  // Clear item rows
  for (let r = 0; r < MAX_ITEMS; r++) {
    const row = ITEM_START_ROW + r
    ws['A' + row] = s('')
    ws['B' + row] = s('')
    ws['H' + row] = s('')
    ws['I' + row] = s('')
    ws['J' + row] = s('')
  }

  // Write items
  const limitedItems = data.items.slice(0, MAX_ITEMS)
  for (let i = 0; i < limitedItems.length; i++) {
    const row = ITEM_START_ROW + i
    const item = limitedItems[i]
    ws['A' + row] = n(i + 1)
    ws['B' + row] = s(item.spec ? item.name + '　' + item.spec : item.name)
    ws['H' + row] = n(item.qty)
    if (item.unit_price !== 0) {
      ws['I' + row] = n(item.unit_price)
      ws['J' + row] = { v: item.qty * item.unit_price, t: 'n' as const, f: `H${row}*I${row}` }
    }
  }

  // Project name
  ws['A35'] = s('案件名：' + data.projectName)

  // Notes (replaces the 畠山様 section)
  ws['A37'] = s(data.notes ? '備考：' + data.notes : '備考：')
  ws['A38'] = s('')

  const wbout = XLSX.write(wb, { bookType: 'xls', type: 'array', cellStyles: true })
  const blob = new Blob([wbout], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `注文書_${data.docNo || '未設定'}_${data.issueDate}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
