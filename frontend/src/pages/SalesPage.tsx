import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths } from 'date-fns'
import { salesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { SalesRecord, SalesPhoto } from '../types'

function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

interface SalesFormData {
  record_date: string
  sales_amount: number
  material_cost: number
  notes: string
}

const defaultForm = (date: string): SalesFormData => ({
  record_date: date,
  sales_amount: 0,
  material_cost: 0,
  notes: '',
})

interface SalesModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SalesFormData, files: File[]) => Promise<void>
  onDelete?: () => Promise<void>
  record: SalesRecord | null
  defaultDate: string
}

const PhotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
    onClick={onClose}
  >
    <div className="relative max-w-full max-h-full p-4" onClick={(e) => e.stopPropagation()}>
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

const SalesModal: React.FC<SalesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  record,
  defaultDate,
}) => {
  const [form, setForm] = useState<SalesFormData>(defaultForm(defaultDate))
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isOpen) {
      if (record) {
        setForm({
          record_date: record.record_date,
          sales_amount: record.sales_amount,
          material_cost: record.material_cost,
          notes: record.notes ?? '',
        })
      } else {
        setForm(defaultForm(defaultDate))
      }
      setNewFiles([])
      setPreviewUrls([])
    }
  }, [isOpen, record, defaultDate])

  const profit = form.sales_amount - form.material_cost

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const existingCount = record?.photos.length ?? 0
    const remaining = 3 - existingCount - newFiles.length
    const toAdd = files.slice(0, remaining)
    setNewFiles((prev) => [...prev, ...toAdd])
    const urls = toAdd.map((f) => URL.createObjectURL(f))
    setPreviewUrls((prev) => [...prev, ...urls])
  }

  const removeNewFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index])
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form, newFiles)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!window.confirm('この記録を削除しますか？')) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  const existingPhotos = record?.photos ?? []
  const totalPhotos = existingPhotos.length + newFiles.length

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-base font-bold text-gray-900">
              {record ? '売上を編集' : '売上を登録'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
              <input
                type="date"
                value={form.record_date}
                onChange={(e) => setForm((f) => ({ ...f, record_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sales amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">売上金額（円）</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.sales_amount === 0 ? '' : form.sales_amount}
                onChange={(e) => setForm((f) => ({ ...f, sales_amount: Number(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Material cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">材料費（円）</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.material_cost === 0 ? '' : form.material_cost}
                onChange={(e) => setForm((f) => ({ ...f, material_cost: Number(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Profit display */}
            <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">利益</span>
              <span className={`text-base font-bold ${profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {formatMoney(profit)}
              </span>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="備考を入力"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                写真（最大3枚）
                {totalPhotos > 0 && (
                  <span className="ml-2 text-xs text-gray-400">{totalPhotos}/3</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {existingPhotos.map((p: SalesPhoto) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxUrl(p.url)}
                    className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <img src={p.url} alt="写真" className="w-full h-full object-cover" />
                  </button>
                ))}
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(url)}
                      className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <img src={url} alt="プレビュー" className="w-full h-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNewFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {totalPhotos < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                  >
                    <span className="text-xl">+</span>
                    <span className="text-xs">写真追加</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-3 sticky bottom-0 bg-white">
            {record && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.record_date}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
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

const SalesPage: React.FC = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<SalesRecord | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const yearMonth = format(currentDate, 'yyyy-MM')

  const { data: records = [], isLoading } = useQuery<SalesRecord[]>({
    queryKey: ['sales', user?.id, yearMonth],
    queryFn: () => salesApi.list({ year_month: yearMonth, user_id: user!.id }).then((r) => r.data),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => salesApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales', user?.id] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => salesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales', user?.id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => salesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales', user?.id] }),
  })

  const uploadPhotosMutation = useMutation({
    mutationFn: ({ id, files }: { id: number; files: File[] }) => salesApi.uploadPhotos(id, files),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales', user?.id] }),
  })

  const totalSales = records.reduce((a, r) => a + r.sales_amount, 0)
  const totalMaterial = records.reduce((a, r) => a + r.material_cost, 0)
  const totalProfit = records.reduce((a, r) => a + r.profit, 0)

  const handleOpenCreate = () => {
    setSelectedRecord(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (record: SalesRecord) => {
    setSelectedRecord(record)
    setModalOpen(true)
  }

  const handleSave = async (formData: SalesFormData, files: File[]) => {
    if (selectedRecord) {
      await updateMutation.mutateAsync({ id: selectedRecord.id, data: { ...formData, user_id: user!.id } })
      if (files.length > 0) {
        await uploadPhotosMutation.mutateAsync({ id: selectedRecord.id, files })
      }
    } else {
      const res = await createMutation.mutateAsync({ ...formData, user_id: user!.id })
      if (files.length > 0) {
        await uploadPhotosMutation.mutateAsync({ id: res.data.id, files })
      }
    }
  }

  const handleDelete = async () => {
    if (selectedRecord) {
      await deleteMutation.mutateAsync(selectedRecord.id)
    }
  }

  const sortedRecords = [...records].sort((a, b) => b.record_date.localeCompare(a.record_date))

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-900">売上管理</h1>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors active:scale-95"
        >
          <span className="text-base leading-none">＋</span>
          <span>売上を登録</span>
        </button>
      </div>

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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '売上合計', value: totalSales, color: 'text-gray-900' },
          { label: '材料費合計', value: totalMaterial, color: 'text-orange-600' },
          { label: '利益合計', value: totalProfit, color: totalProfit >= 0 ? 'text-blue-600' : 'text-red-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1 truncate">{card.label}</p>
            <p className={`text-sm sm:text-base font-bold ${card.color} truncate`}>
              {formatMoney(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Records list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">この月の売上記録はありません</p>
          <button
            onClick={handleOpenCreate}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            ＋ 売上を登録する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRecords.map((record) => (
            <div
              key={record.id}
              onClick={() => handleOpenEdit(record)}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900">{record.record_date}</span>
                    {record.notes && (
                      <span className="text-xs text-gray-500 truncate">{record.notes}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">売上</p>
                      <p className="font-semibold text-gray-800">{formatMoney(record.sales_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">材料費</p>
                      <p className="font-semibold text-orange-600">{formatMoney(record.material_cost)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">利益</p>
                      <p className={`font-semibold ${record.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatMoney(record.profit)}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Photo thumbnails */}
                {record.photos.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {record.photos.slice(0, 3).map((p: SalesPhoto) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLightboxUrl(p.url)
                        }}
                        className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <img src={p.url} alt="写真" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sales modal */}
      <SalesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={selectedRecord ? handleDelete : undefined}
        record={selectedRecord}
        defaultDate={format(new Date(), 'yyyy-MM-dd')}
      />

      {/* Lightbox */}
      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  )
}

export default SalesPage
