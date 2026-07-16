'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, SalesRecord, SalesPhoto } from '@/lib/supabase/types'
import { useSidebar } from '@/lib/sidebar-context'
import PhotoLightbox from '@/components/PhotoLightbox'

const PAGE_SIZE = 10

export interface SalesWithProfile extends SalesRecord {
  profile?: Profile
}

interface AdminSalesClientProps {
  initialYearMonth: string
  initialRecords: SalesWithProfile[]
  initialProfiles: Profile[]
  initialPhotoCounts: Record<number, number>
  initialPhotoThumbs: Record<number, string>
}

export default function AdminSalesClient({ initialYearMonth, initialRecords, initialProfiles, initialPhotoCounts, initialPhotoThumbs }: AdminSalesClientProps) {
  const openSidebar = useSidebar()
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [records, setRecords] = useState<SalesWithProfile[]>(initialRecords)
  const [photoCounts, setPhotoCounts] = useState<Record<number, number>>(initialPhotoCounts)
  const [photoThumbs, setPhotoThumbs] = useState<Record<number, string>>(initialPhotoThumbs)
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [loading, setLoading] = useState(false)
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [modal, setModal] = useState<{ record?: SalesRecord | null; date?: string } | null>(null)
  const [page, setPage] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const [recordsRes, profilesRes] = await Promise.all([
      supabase.from('sales_records').select('*')
        .gte('record_date', `${yearMonth}-01`)
        .lte('record_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`)
        .order('record_date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
    ])
    const profileList = profilesRes.data ?? []
    setProfiles(profileList)
    const profileMap = Object.fromEntries(profileList.map(p => [p.id, p]))
    const recs = (recordsRes.data ?? []).map(r => ({ ...r, profile: profileMap[r.user_id] }))
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
    fetchData()
  }, [fetchData])

  const filtered = filterUserId === 'all' ? records : records.filter(r => r.user_id === filterUserId)
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const totalCost = filtered.reduce((s, r) => s + (r.cost ?? 0), 0)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedFiltered = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const prevMonth = () => {
    setPage(0)
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    setPage(0)
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const handleFilterChange = (id: string) => {
    setPage(0)
    setFilterUserId(id)
  }

  return (
    <div className="p-4">
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
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filterUserId}
            onChange={e => handleFilterChange(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全員</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setModal({ date: new Date().toLocaleDateString('sv-SE') })}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow"
          >
            + 追加
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-4 px-1">
        <div className="text-xs md:text-sm text-gray-500">売上 <span className="text-gray-900 font-medium">¥{totalAmount.toLocaleString()}</span></div>
        <div className="text-xs md:text-sm text-gray-500">原価 <span className="text-gray-900 font-medium">¥{totalCost.toLocaleString()}</span></div>
        <div className="text-xs md:text-sm text-gray-500">粗利 <span className="font-medium text-green-700">¥{(totalAmount - totalCost).toLocaleString()}</span></div>
        <div className="text-xs text-gray-400 ml-auto">{filtered.length}件</div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">記録がありません</div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {pagedFiltered.map(r => (
            <div
              key={r.id}
              onClick={() => setModal({ record: r })}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-50 cursor-pointer transition-all min-w-0"
            >
              {photoThumbs[r.id] ? (
                <div
                  className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100"
                  onClick={e => { e.stopPropagation(); setLightboxUrl(photoThumbs[r.id]) }}
                >
                  <img src={photoThumbs[r.id]} alt="" className="w-full h-full object-cover" />
                  {photoCounts[r.id] > 1 && (
                    <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] leading-none px-1 py-0.5 rounded-tl">
                      {photoCounts[r.id]}
                    </span>
                  )}
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg shrink-0 bg-gray-50" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-gray-500 shrink-0">{r.record_date.slice(5).replace('-', '/')}</span>
                  <span className="text-xs font-medium text-gray-700 truncate">{r.profile?.name ?? '—'}</span>
                </div>
                <div className="text-sm text-gray-900 truncate mt-0.5">{r.description || '—'}</div>
                <span className="text-base font-medium text-gray-900">¥{r.amount.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹ 前へ
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              次へ ›
            </button>
          </div>
        )}
        </>
      )}

      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {modal !== null && (
        <AdminSalesModal
          profiles={profiles}
          record={modal.record}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

interface AdminSalesModalProps {
  profiles: Profile[]
  record?: SalesRecord | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

function AdminSalesModal({ profiles, record, defaultDate, onClose, onSaved }: AdminSalesModalProps) {
  const [userId, setUserId] = useState(record?.user_id ?? profiles[0]?.id ?? '')
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
  const [lightboxPhotoId, setLightboxPhotoId] = useState<number | null>(null)
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
    if (!confirm('この写真を削除しますか？')) return
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm md:max-w-2xl lg:max-w-4xl mx-4 p-6 md:p-8 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {record ? '売上記録を編集' : '売上記録を追加'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">従業員</label>
            <select value={userId} onChange={e => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
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
                <div key={p.id} className="relative w-20 h-20 md:w-28 md:h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {photoUrls[p.id]
                    ? <img src={photoUrls[p.id]} alt={p.original_name} className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightboxPhotoId(p.id)} />
                    : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">読込中</div>
                  }
                </div>
              ))}
              {newPreviews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 md:w-28 md:h-28 rounded-lg overflow-hidden border border-blue-200 bg-gray-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeNewFile(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 md:w-28 md:h-28 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors">
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs mt-1">写真追加</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          {record && <button onClick={handleDelete} disabled={saving} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">削除</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !date || !userId}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      {lightboxPhotoId !== null && photoUrls[lightboxPhotoId] && (
        <PhotoLightbox
          url={photoUrls[lightboxPhotoId]}
          onClose={() => setLightboxPhotoId(null)}
          onDelete={() => {
            const photo = existingPhotos.find(p => p.id === lightboxPhotoId)
            setLightboxPhotoId(null)
            if (photo) deleteExistingPhoto(photo)
          }}
        />
      )}
    </div>
  )
}
