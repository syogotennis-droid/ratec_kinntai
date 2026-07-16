'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SalesRecord, SalesPhoto } from '@/lib/supabase/types'
import { useProfile } from '@/lib/profile-context'
import { useSidebar } from '@/lib/sidebar-context'

interface SalesClientProps {
  initialYearMonth: string
  initialRecords: SalesRecord[]
  initialProfiles: { id: string; name: string }[]
  initialPhotoCounts: Record<number, number>
  initialPhotoThumbs: Record<number, string>
}

export default function SalesClient({ initialYearMonth, initialRecords, initialProfiles, initialPhotoCounts, initialPhotoThumbs }: SalesClientProps) {
  const profile = useProfile()
  const openSidebar = useSidebar()
  const userId = profile.id
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [records, setRecords] = useState<SalesRecord[]>(initialRecords)
  const [profiles] = useState<{ id: string; name: string }[]>(initialProfiles)
  const [photoCounts, setPhotoCounts] = useState<Record<number, number>>(initialPhotoCounts)
  const [photoThumbs, setPhotoThumbs] = useState<Record<number, string>>(initialPhotoThumbs)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ record?: SalesRecord | null; date?: string } | null>(null)

  const nameById = (id: string) => profiles.find(p => p.id === id)?.name ?? '—'

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const { data } = await supabase
      .from('sales_records')
      .select('*')
      .gte('record_date', `${yearMonth}-01`)
      .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('record_date', { ascending: false })
    const recs = data ?? []
    setRecords(recs)
    setLoading(false)

    if (recs.length === 0) { setPhotoCounts({}); setPhotoThumbs({}); return }
    const { data: photos } = await supabase
      .from('sales_photos')
      .select('sales_record_id, storage_path, created_at')
      .in('sales_record_id', recs.map(r => r.id))
      .order('created_at', { ascending: true })
    if (!photos) return
    const counts: Record<number, number> = {}
    const firstPathByRecord: Record<number, string> = {}
    for (const p of photos) {
      counts[p.sales_record_id] = (counts[p.sales_record_id] ?? 0) + 1
      if (!(p.sales_record_id in firstPathByRecord)) firstPathByRecord[p.sales_record_id] = p.storage_path
    }
    setPhotoCounts(counts)

    const entries = Object.entries(firstPathByRecord)
    if (entries.length === 0) { setPhotoThumbs({}); return }
    const { data: signed } = await supabase.storage.from('sales-photos').createSignedUrls(entries.map(([, path]) => path), 3600)
    const thumbs: Record<number, string> = {}
    signed?.forEach((s, i) => { if (s.signedUrl) thumbs[Number(entries[i][0])] = s.signedUrl })
    setPhotoThumbs(thumbs)
  }, [yearMonth])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchRecords()
  }, [fetchRecords])

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
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 px-1 mb-3">
        <button onClick={openSidebar} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-lg leading-none">‹</button>
          <span className="text-base font-bold text-gray-900 px-2">{yearMonth.replace('-', '年')}月</span>
          <button onClick={nextMonth} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-lg leading-none">›</button>
        </div>
        <button
          onClick={() => setModal({ date: new Date().toLocaleDateString('sv-SE') })}
          className="ml-auto px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow"
        >
          + 追加
        </button>
      </div>
      <div className="px-4">

      <div className="flex gap-4 mb-4 px-1">
        <div className="text-xs md:text-sm text-gray-500">売上 <span className="text-gray-900 font-medium">¥{totalAmount.toLocaleString()}</span></div>
        <div className="text-xs md:text-sm text-gray-500">原価 <span className="text-gray-900 font-medium">¥{totalCost.toLocaleString()}</span></div>
        <div className="text-xs md:text-sm text-gray-500">粗利 <span className="font-medium text-green-700">¥{(totalAmount - totalCost).toLocaleString()}</span></div>
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
              className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-50 cursor-pointer transition-all"
            >
              {photoThumbs[r.id] ? (
                <div className="relative w-10 h-10 md:w-20 md:h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                  <img src={photoThumbs[r.id]} alt="" className="w-full h-full object-cover" />
                  {photoCounts[r.id] > 1 && (
                    <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] md:text-xs leading-none px-1 py-0.5 rounded-tl">
                      {photoCounts[r.id]}
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-10 md:w-20 shrink-0" />
              )}
              <div className="w-12 md:w-16 text-xs md:text-sm text-gray-500 shrink-0">
                {r.record_date.slice(5).replace('-', '/')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs md:text-sm font-medium text-gray-600 shrink-0">{nameById(r.user_id)}</span>
                  {r.user_id !== userId && <span className="text-[10px] text-gray-400 shrink-0">閲覧のみ</span>}
                </div>
                <div className="text-sm md:text-base text-gray-900 truncate">{r.description || '—'}</div>
                {(r.cost ?? 0) > 0 && (
                  <div className="text-xs md:text-sm text-gray-400">原価 ¥{(r.cost ?? 0).toLocaleString()}</div>
                )}
              </div>
              <div className="text-sm md:text-lg font-medium text-gray-900 shrink-0">¥{r.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <SalesModal
          userId={userId}
          record={modal.record}
          defaultDate={modal.date}
          readOnly={!!modal.record && modal.record.user_id !== userId}
          ownerName={modal.record ? nameById(modal.record.user_id) : ''}
          onClose={() => setModal(null)}
          onSaved={fetchRecords}
        />
      )}
      </div>
    </div>
  )
}

interface SalesModalProps {
  userId: string
  record?: SalesRecord | null
  defaultDate?: string
  readOnly?: boolean
  ownerName?: string
  onClose: () => void
  onSaved: () => void
}

function SalesModal({ userId, record, defaultDate, readOnly = false, ownerName, onClose, onSaved }: SalesModalProps) {
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
          {readOnly ? `${ownerName}さんの売上記録` : record ? '売上記録を編集' : '売上記録を追加'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">売上（円）</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0} disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">原価（円）</label>
              <input type="number" value={cost} onChange={e => setCost(e.target.value)} min={0} disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
          </div>
          {(amountNum > 0 || costNum > 0) && (
            <div className="text-xs text-gray-500 px-1">
              粗利 <span className="font-medium text-green-700">¥{(amountNum - costNum).toLocaleString()}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">内容</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-500" />
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
                  {!readOnly && (
                    <button onClick={() => deleteExistingPhoto(p)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">×</button>
                  )}
                </div>
              ))}
              {!readOnly && newPreviews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-blue-200 bg-gray-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeNewFile(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              {!readOnly && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors">
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-xs mt-1">写真追加</span>
                </button>
              )}
              {readOnly && existingPhotos.length === 0 && (
                <div className="text-xs text-gray-400 py-2">写真なし</div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          {record && !readOnly && (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            {readOnly ? '閉じる' : 'キャンセル'}
          </button>
          {!readOnly && (
            <button onClick={handleSave} disabled={saving || !date}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
              {saving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
