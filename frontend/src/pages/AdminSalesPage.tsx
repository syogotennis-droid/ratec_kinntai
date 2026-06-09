import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths } from 'date-fns'
import { salesApi, usersApi } from '../services/api'
import { SalesRecord, MonthlySalesSummary, SalesPhoto, User } from '../types'

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const PhotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
    onClick={onClose}
  >
    <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full hover:bg-black/70 z-10"
      >
        ✕
      </button>
      <img src={url} alt="写真" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
    </div>
  </div>
)

interface DetailModalProps {
  record: SalesRecord | null
  onClose: () => void
  onSaved: () => void
  onPhotoDelete: (photoId: number) => Promise<void>
}

const DetailModal: React.FC<DetailModalProps> = ({ record, onClose, onSaved, onPhotoDelete }) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    record_date: record?.record_date ?? '',
    sales_amount: record?.sales_amount ?? 0,
    material_cost: record?.material_cost ?? 0,
    notes: record?.notes ?? '',
  })
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null)

  React.useEffect(() => {
    if (record) {
      setForm({
        record_date: record.record_date,
        sales_amount: record.sales_amount,
        material_cost: record.material_cost,
        notes: record.notes ?? '',
      })
    }
  }, [record])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => salesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] })
      queryClient.invalidateQueries({ queryKey: ['admin-sales-monthly'] })
    },
  })

  const handleSave = async () => {
    if (!record) return
    setSaving(true)
    try {
      await updateMutation.mutateAsync({ id: record.id, data: form })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoDelete = async (photoId: number) => {
    if (!window.confirm('この写真を削除しますか？')) return
    setDeletingPhotoId(photoId)
    try {
      await onPhotoDelete(photoId)
    } finally {
      setDeletingPhotoId(null)
    }
  }

  if (!record) return null
  const profit = form.sales_amount - form.material_cost

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-base font-bold text-gray-900">売上記録の詳細</h2>
              <p className="text-xs text-gray-500 mt-0.5">{record.user_name}（{record.employee_id}）</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
              <input
                type="date"
                value={form.record_date}
                onChange={(e) => setForm((f) => ({ ...f, record_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">売上金額（円）</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.sales_amount === 0 ? '' : form.sales_amount}
                onChange={(e) => setForm((f) => ({ ...f, sales_amount: Number(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">材料費（円）</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.material_cost === 0 ? '' : form.material_cost}
                onChange={(e) => setForm((f) => ({ ...f, material_cost: Number(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">利益</span>
              <span className={`text-base font-bold ${profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {formatYen(profit)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Photos */}
            {record.photos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">写真</label>
                <div className="flex flex-wrap gap-2">
                  {record.photos.map((p: SalesPhoto) => (
                    <div key={p.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(p.url)}
                        className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 block"
                      >
                        <img src={p.url} alt="写真" className="w-full h-full object-cover" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingPhotoId === p.id}
                        onClick={() => handlePhotoDelete(p.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  )
}

const AdminSalesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<SalesRecord | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const yearMonth = format(currentDate, 'yyyy-MM')

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { data: records = [], isLoading } = useQuery<SalesRecord[]>({
    queryKey: ['admin-sales', yearMonth, selectedUserId],
    queryFn: () =>
      salesApi
        .list({ year_month: yearMonth, ...(selectedUserId ? { user_id: selectedUserId } : {}) })
        .then((r) => r.data),
  })

  const { data: monthlySummaries = [] } = useQuery<MonthlySalesSummary[]>({
    queryKey: ['admin-sales-monthly', yearMonth],
    queryFn: () => salesApi.monthly(yearMonth).then((r) => r.data),
  })

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: number) => salesApi.deletePhoto(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sales'] })
      // Also update selectedRecord photos optimistically by refetching
    },
  })

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await salesApi.exportCsv(yearMonth)
      downloadBlob(res.data, `${yearMonth}_売上一覧.csv`)
    } catch {
      showMessage('error', 'エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePhotoDelete = async (photoId: number) => {
    await deletePhotoMutation.mutateAsync(photoId)
    // Update selectedRecord's photos in state
    if (selectedRecord) {
      setSelectedRecord((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : null
      )
    }
  }

  const sortedRecords = [...records].sort((a, b) => {
    const dateCompare = b.record_date.localeCompare(a.record_date)
    if (dateCompare !== 0) return dateCompare
    return (a.user_name ?? '').localeCompare(b.user_name ?? '')
  })

  const activeUsers = users.filter((u) => u.is_active && !u.is_admin)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-900">売上管理（管理者）</h1>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <span>📥</span>
          <span className="hidden sm:inline">CSV</span>エクスポート
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold text-gray-900 min-w-[120px] text-center">
          {format(currentDate, 'yyyy年M月')}
        </span>
        <button
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
        >
          今月
        </button>
      </div>

      {/* Employee filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        <button
          onClick={() => setSelectedUserId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
            selectedUserId === null
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          全員
        </button>
        {activeUsers.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUserId(u.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              selectedUserId === u.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {u.name}
          </button>
        ))}
      </div>

      {/* Monthly Summary Table */}
      {selectedUserId === null && monthlySummaries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">従業員別月次集計</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">社員番号</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">売上合計</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">材料費合計</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">利益合計</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">件数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlySummaries.map((s) => (
                  <tr
                    key={s.user_id}
                    onClick={() => setSelectedUserId(s.user_id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{s.user_name}</td>
                    <td className="px-3 py-3 text-right text-gray-500 hidden sm:table-cell text-xs">{s.employee_id}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">{formatYen(s.total_sales)}</td>
                    <td className="px-3 py-3 text-right text-orange-600 hidden md:table-cell">{formatYen(s.total_material)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${s.total_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatYen(s.total_profit)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 hidden sm:table-cell">{s.record_count}件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Records table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">この月の売上記録はありません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">
              日別記録
              <span className="ml-2 text-gray-400 font-normal">（{sortedRecords.length}件）</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">日付</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">売上</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">材料費</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">利益</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">備考</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 hidden sm:table-cell">写真</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{record.record_date}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{record.user_name}</td>
                    <td className="px-3 py-3 text-right text-gray-900 font-medium whitespace-nowrap">{formatYen(record.sales_amount)}</td>
                    <td className="px-3 py-3 text-right text-orange-600 hidden sm:table-cell whitespace-nowrap">{formatYen(record.material_cost)}</td>
                    <td className={`px-3 py-3 text-right font-semibold whitespace-nowrap ${record.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatYen(record.profit)}
                    </td>
                    <td className="px-3 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">
                      {record.notes ?? '-'}
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      {record.photos.length > 0 ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {record.photos.length}枚
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedRecord && (
        <DetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onSaved={() => showMessage('success', '保存しました')}
          onPhotoDelete={handlePhotoDelete}
        />
      )}
    </div>
  )
}

export default AdminSalesPage
