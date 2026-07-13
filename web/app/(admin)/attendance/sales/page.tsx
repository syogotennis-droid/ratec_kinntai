'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SalesRecord, SalesPhoto } from '@/lib/supabase/types'
import { useProfile } from '@/lib/profile-context'

export default function MySalesPage() {
  const profile = useProfile()
  const userId = profile.id
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [photoCounts, setPhotoCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ record?: SalesRecord | null; date?: string } | null>(null)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('sales_records')
      .select('*')
      .eq('user_id', userId)
      .gte('record_date', `${yearMonth}-01`)
      .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('record_date', { ascending: false })
    const recs = data ?? []
    setRecords(recs)
    setLoading(false)

    if (recs.length === 0) return
    const { data: photos } = await supabase
      .from('sales_photos')
      .select('id, sales_record_id')
      .in('sales_record_id', recs.map(r => r.id))
    if (!photos) return
    const counts: Record<number, number> = {}
    for (const p of photos) counts[p.sales_record_id] = (counts[p.sales_record_id] ?? 0) + 1
    setPhotoCounts(counts)
  }, [userId, yearMonth])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const totalAmount = records.reduce((s, r) => s + r.amount, 0)
  const totalCost = records.reduce((s, r) => s + (r.cost ?? 0), 0)

  const prevMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }



  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">‹</button>
          <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">›</button>
        </div>
        <button
          onClick={() => setModal({ date: new Date().toISOString().slice(0, 10) })}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          + 追加
        </button>
      </div>

      <div className="flex gap-4 mb-4 px-1">
        <div className="text-xs text-gray-500">売上 <span className="text-gray-900 font-medium">¥{totalAmount.toLocaleString()}</span></div>
        <div className="text-xs text-gray-500">原価 <span className="text-gray-900 font-medium">¥{totalCost.toLocaleString()}</span></div>
        <div className="text-xs text-gray-500">粗利 <span className="font-medium text-green-700">¥{(totalAmount - totalCost).toLocaleString()}</span></div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">記録がありません</div>
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <div
              key={r.id}
              onClick={() => setModal({ record: r })}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
            >
              {photoCounts[r.id] ? (
                <div className="flex flex-col items-center shrink-0 text-blue-500">
                  <span className="text-lg">📷</span>
                  <span className="text-xs font-medium">{photoCounts[r.id]}</span>
                </div>
              ) : (
                <div className="w-6 shrink-0" />
              )}
              <div className="w-12 text-xs text-gray-500 shrink-0">
                {r.record_date.slice(5).replace('-', '/')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">{r.description || '—'}</div>
                {(r.cost ?? 0) > 0 && (
                  <div className="text-xs text-gray-400">原価 ¥{(r.cost ?? 0).toLocaleString()}</div>
                )}
              </div>
              <div className="text-sm font-medium text-gray-900 shrink-0">¥{r.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <SalesModal
          userId={userId}
          record={modal.record}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={fetchRecords}
        />
      )}
    </div>
  )
}

interface SalesModalProps {
  userId: string
  record?: SalesRecord | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

function SalesModal({ userId, record, defaultDate, onClose, onSaved }: SalesModalProps) {
  const [date, setDate] = useState(record?.record_date ?? defaultDate ?? '')
  const [amount, setAmount] = useState(String(record?.amount ?? ''))
  const [cost, setCost] = useState(String(record?.cost ?? ''))
  const [description, setDescription] = useState(record?.description ?? '')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [existingPhotos, setExistingPhotos] = useState<SalesPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({})
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!record) return
    const supabase = createClient()
    supabase.from('sales_photos').select('*').eq('sales_record_id', record.id).then(async ({ data }) => {
      const photos = data ?? []
      setExistingPhotos(photos)
      const urls: Record<number, string> = {}
      await Promise.all(photos.map(async (p) => {
        const { data: urlData } = await supabase.storage.from('sales-photos').createSignedUrl(p.storage_path, 3600)
        if (urlData?.signedUrl) urls[p.id] = urlData.signedUrl
      }))
      setPhotoUrls(urls)
    })
  }, [record])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setNewFiles(prev => [...prev, ...files])
    setNewPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  const removeNewFile = (i: number) => {
    URL.revokeObjectURL(newPreviews[i])
    setNewFiles(prev => prev.filter((_, j) => j !== i))
    setNewPreviews(prev => prev.filter((_, j) => j !== i))
  }

  const deleteExistingPhoto = async (photo: SalesPhoto) => {
    const supabase = createClient()
    await supabase.storage.from('sales-photos').remove([photo.storage_path])
    await supabase.from('sales_photos').delete().eq('id', photo.id)
    setExistingPhotos(prev => prev.filter(p => p.id !== photo.id))
    setPhotoUrls(prev => { const n = { ...prev }; delete n[photo.id]; return n })
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        user_id: userId,
        record_date: date,
        amount: Number(amount) || 0,
        cost: Number(cost) || 0,
        description: description || null,
        notes: notes || null,
      }

      let recordId: number
      if (record) {
        await supabase.from('sales_records').update(payload).eq('id', record.id)
        recordId = record.id
      } else {
        const { data, error: insertError } = await supabase.from('sales_records').insert(payload).select('id').single()
        if (insertError || !data) throw new Error(insertError?.message ?? '保存失敗')
        recordId = data.id
      }

      for (const file of newFiles) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${userId}/${recordId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('sales-photos').upload(path, file)
        if (uploadError) continue
        await supabase.from('sales_photos').insert({ sales_record_id: recordId, storage_path: path, original_name: file.name })
      }

      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!record || !confirm('削除しますか？')) return
    setSaving(true)
    try {
      const supabase = createClient()
      if (existingPhotos.length > 0) {
        await supabase.storage.from('sales-photos').remove(existingPhotos.map(p => p.storage_path))
        await supabase.from('sales_photos').delete().eq('sales_record_id', record.id)
      }
      await supabase.from('sales_records').delete().eq('id', record.id)
      onSaved()
      onClose()
    } catch {
      setError('削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const amountNum = Number(amount) || 0
  const costNum = Number(cost) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {record ? '売上記録を編集' : '売上記録を追加'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">売上（円）</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">原価（円）</label>
              <input type="number" value={cost} onChange={e => setCost(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {(amountNum > 0 || costNum > 0) && (
            <div className="text-xs text-gray-500 px-1">
              粗利 <span className="font-medium text-green-700">¥{(amountNum - costNum).toLocaleString()}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">内容</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">写真</label>
            <div className="flex flex-wrap gap-2">
              {existingPhotos.map(p => (
                <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {photoUrls[p.id]
                    ? <img src={photoUrls[p.id]} alt={p.original_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">読込中</div>
                  }
                  <button onClick={() => deleteExistingPhoto(p)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              {newPreviews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-blue-200 bg-gray-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeNewFile(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors">
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs mt-1">写真追加</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          {record && (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !date}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
