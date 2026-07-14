import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { PURCHASE_ORDER_TEMPLATE_B64 } from '@/lib/excel/purchase-order-template-b64'

const ITEM_START_ROW = 22
const MAX_ITEMS = 10

interface Item {
  name: string
  spec: string
  qty: number
  unit_price: number
  amount: number
}

interface RequestBody {
  docNo: string
  issueDate: string
  supplierName: string
  projectName: string
  notes: string
  items: Item[]
}

export async function POST(request: NextRequest) {
  const data: RequestBody = await request.json()

  const wb = new ExcelJS.Workbook()
  const templateBuffer = Buffer.from(PURCHASE_ORDER_TEMPLATE_B64, 'base64') as unknown as ArrayBuffer
  await wb.xlsx.load(templateBuffer)

  const ws = wb.getWorksheet(1)!

  // Helper: set cell value without touching style
  const set = (addr: string, value: ExcelJS.CellValue) => {
    ws.getCell(addr).value = value
  }

  // 注文書番号
  set('L3', data.docNo)

  // 日付
  set('J6', new Date(data.issueDate + 'T00:00:00'))
  ws.getCell('J6').numFmt = 'yyyy/m/d'

  // 仕入先（宛先）
  set('A8', data.supplierName ? data.supplierName + '　　御中' : '')

  // 納期日欄クリア（テンプレートの古い日付を消す）
  set('B14', null)

  // 明細クリア
  for (let r = 0; r < MAX_ITEMS; r++) {
    const row = ITEM_START_ROW + r
    set(`A${row}`, null)
    set(`B${row}`, null)
    set(`H${row}`, null)
    set(`I${row}`, null)
    set(`J${row}`, null)
  }

  // 明細書き込み
  const limited = data.items.slice(0, MAX_ITEMS)
  for (let i = 0; i < limited.length; i++) {
    const row = ITEM_START_ROW + i
    const item = limited[i]
    set(`A${row}`, i + 1)
    set(`B${row}`, item.spec ? item.name + '　' + item.spec : item.name)
    set(`H${row}`, item.qty)
    if (item.unit_price !== 0) {
      set(`I${row}`, item.unit_price)
      set(`J${row}`, item.qty * item.unit_price)
    }
  }

  // 工事名
  set('A35', '案件名：' + data.projectName)

  // 備考
  set('A37', data.notes ? '備考：' + data.notes : '備考：')
  set('A38', null)

  const buffer = await wb.xlsx.writeBuffer()
  const filename = encodeURIComponent(`注文書_${data.docNo || '未設定'}_${data.issueDate}.xlsx`)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  })
}
