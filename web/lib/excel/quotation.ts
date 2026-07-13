import { DocumentItem, Settings } from '@/lib/supabase/types'

interface QuotationExcelData {
  docNo: string
  issueDate: string
  customerName: string
  projectName: string
  notes: string
  items: Omit<DocumentItem, 'id'>[]
  subtotal: number
  taxAmount: number
  totalAmount: number
  settings: Settings | null
}

const ITEM_START_ROW = 15
const ITEM_END_ROW = 28

export async function downloadQuotationExcel(data: QuotationExcelData) {
  const ExcelJSModule = await import('exceljs')
  const wb = new ExcelJSModule.default.Workbook()

  const res = await fetch('/templates/quotation.xlsx')
  const arrayBuffer = await res.arrayBuffer()
  await wb.xlsx.load(arrayBuffer)

  const ws = wb.getWorksheet('テンプレート')
  if (!ws) throw new Error('テンプレートシートが見つかりません')

  // 宛先 (A2:D3 merged の左上セル)
  ws.getCell('A2').value = data.customerName ? `${data.customerName}　御中` : ''

  // 日付 (G3)
  const [y, m, d] = data.issueDate.split('-')
  ws.getCell('G3').value = data.issueDate ? `${y}年${m}月${d}日` : ''

  // 担当者行 (A4) は空欄のまま
  ws.getCell('A4').value = ''

  // 件名 (B7)
  ws.getCell('B7').value = data.projectName ?? ''

  // 明細行クリア → 入力
  for (let row = ITEM_START_ROW; row <= ITEM_END_ROW; row++) {
    const itemIdx = row - ITEM_START_ROW
    const item = data.items[itemIdx]

    // A列 (A:C merged) = 品名 [仕様]
    const nameCell = ws.getCell(`A${row}`)
    nameCell.value = item ? (item.spec ? `${item.name}　${item.spec}` : item.name) : ''

    // D = 数量
    const qtyCell = ws.getCell(`D${row}`)
    qtyCell.value = item ? item.qty : null

    // E = 単位
    const unitCell = ws.getCell(`E${row}`)
    unitCell.value = item ? item.unit : ''

    // F = 単価
    const priceCell = ws.getCell(`F${row}`)
    priceCell.value = item ? item.unit_price : null

    // G = 金額（formulaの結果として設定）
    const amountCell = ws.getCell(`G${row}`)
    if (item) {
      amountCell.value = { formula: `D${row}*F${row}`, result: item.amount }
    } else {
      amountCell.value = null
    }
  }

  // 備考欄はそのまま空欄（テンプレート通り）

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `見積書_${data.docNo}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
