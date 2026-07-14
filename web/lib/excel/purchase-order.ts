import { DocumentItem } from '@/lib/supabase/types'

export interface PurchaseOrderExcelData {
  docNo: string
  issueDate: string
  supplierName: string
  projectName: string
  notes: string
  items: Omit<DocumentItem, 'id'>[]
}

export async function downloadPurchaseOrderExcel(data: PurchaseOrderExcelData) {
  const res = await fetch('/api/purchase-orders/excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok) throw new Error('Excel生成に失敗しました')

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `注文書_${data.docNo || '未設定'}_${data.issueDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
