import ExcelJS from 'exceljs'
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

export async function downloadQuotationExcel(data: QuotationExcelData) {
  const ExcelJSModule = await import('exceljs')
  const wb = new ExcelJSModule.default.Workbook()
  const ws = wb.addWorksheet('見積書')

  ws.columns = [
    { width: 6 },   // A No
    { width: 26 },  // B 品名
    { width: 20 },  // C 仕様
    { width: 8 },   // D 数量
    { width: 7 },   // E 単位
    { width: 14 },  // F 単価
    { width: 14 },  // G 金額
    { width: 2 },   // H spacer
    { width: 24 },  // I 自社情報
  ]

  const s = data.settings

  // タイトル
  ws.mergeCells('A1:G1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '見　　積　　書'
  titleCell.font = { size: 18, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 36

  // 自社情報（右側）
  const companyLines = [
    s?.company_name ?? '',
    s ? `〒${s.company_postal}` : '',
    s?.company_address ?? '',
    s?.company_tel ? `TEL: ${s.company_tel}` : '',
    s?.company_fax ? `FAX: ${s.company_fax}` : '',
    s?.company_email ? `Email: ${s.company_email}` : '',
  ].filter(Boolean)
  companyLines.forEach((line, i) => {
    const cell = ws.getCell(`I${i + 2}`)
    cell.value = line
    cell.font = i === 0 ? { bold: true } : { size: 9 }
  })

  // 顧客名
  ws.getRow(3).height = 20
  ws.mergeCells('A3:D3')
  const customerCell = ws.getCell('A3')
  customerCell.value = `${data.customerName}　御中`
  customerCell.font = { size: 13, bold: true }

  ws.mergeCells('A4:D4')
  ws.getCell('A4').value = `案件名：${data.projectName}`
  ws.getCell('A4').font = { size: 10 }

  // 見積書番号・発行日
  ws.getRow(6).height = 18
  ws.getCell('A6').value = '見積書番号'
  ws.getCell('A6').font = { bold: true, size: 9 }
  ws.mergeCells('B6:C6')
  ws.getCell('B6').value = data.docNo

  ws.getCell('A7').value = '発行日'
  ws.getCell('A7').font = { bold: true, size: 9 }
  ws.mergeCells('B7:C7')
  ws.getCell('B7').value = data.issueDate

  ws.getCell('A8').value = '有効期限'
  ws.getCell('A8').font = { bold: true, size: 9 }
  ws.mergeCells('B8:C8')
  ws.getCell('B8').value = '発行日より30日間'

  // 挨拶文
  ws.getRow(10).height = 16
  ws.mergeCells('A10:G10')
  ws.getCell('A10').value = '下記の通り、お見積り申し上げます。'
  ws.getCell('A10').font = { size: 10 }

  // 明細ヘッダー
  const HEADER_ROW = 12
  ws.getRow(HEADER_ROW).height = 18
  const headers = ['No', '品名', '仕様', '数量', '単位', '単価', '金額']
  const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  headers.forEach((h, i) => {
    const cell = ws.getCell(`${headerCols[i]}${HEADER_ROW}`)
    cell.value = h
    cell.font = { bold: true, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }
  })

  // 明細行
  let row = HEADER_ROW + 1
  data.items.forEach((item, idx) => {
    const values = [idx + 1, item.name, item.spec, item.qty, item.unit, item.unit_price, item.amount]
    values.forEach((v, i) => {
      const cell = ws.getCell(`${headerCols[i]}${row}`)
      cell.value = v
      cell.font = { size: 10 }
      cell.border = {
        top: { style: 'hair' }, bottom: { style: 'hair' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
      if (i === 0) cell.alignment = { horizontal: 'center' }
      if (i === 3 || i === 4) cell.alignment = { horizontal: 'center' }
      if (i === 5 || i === 6) {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right' }
      }
    })
    row++
  })

  // 空行を追加して合計まで明細エリアを見やすく
  if (data.items.length < 10) {
    for (let i = data.items.length; i < 10; i++) {
      const emptyRow = row++
      headerCols.forEach(col => {
        const cell = ws.getCell(`${col}${emptyRow}`)
        cell.border = {
          top: { style: 'hair' }, bottom: { style: 'hair' },
          left: { style: 'thin' }, right: { style: 'thin' },
        }
      })
    }
  }

  // 合計エリア
  const totals = [
    { label: '小　　計', value: data.subtotal },
    { label: '消費税（10%）', value: data.taxAmount },
    { label: '合　計　金　額', value: data.totalAmount },
  ]
  totals.forEach(({ label, value }, i) => {
    const r = row + i
    ws.mergeCells(`A${r}:E${r}`)
    const labelCell = ws.getCell(`A${r}`)
    labelCell.value = label
    labelCell.font = { bold: i === 2, size: 10 }
    labelCell.alignment = { horizontal: 'right' }
    labelCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }

    ws.mergeCells(`F${r}:G${r}`)
    const valCell = ws.getCell(`F${r}`)
    valCell.value = value
    valCell.numFmt = '¥#,##0'
    valCell.font = { bold: i === 2, size: i === 2 ? 12 : 10 }
    valCell.alignment = { horizontal: 'right', vertical: 'middle' }
    valCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    if (i === 2) {
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
      ws.getRow(r).height = 22
    }
  })
  row += 3

  // 備考
  if (data.notes) {
    row++
    ws.getCell(`A${row}`).value = '【備考】'
    ws.getCell(`A${row}`).font = { bold: true, size: 10 }
    row++
    ws.mergeCells(`A${row}:G${row + 2}`)
    const notesCell = ws.getCell(`A${row}`)
    notesCell.value = data.notes
    notesCell.alignment = { wrapText: true, vertical: 'top' }
    notesCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    ws.getRow(row).height = 60
  }

  // ページ設定
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `見積書_${data.docNo}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
