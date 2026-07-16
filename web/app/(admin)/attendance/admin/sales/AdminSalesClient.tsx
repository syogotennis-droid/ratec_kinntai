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

function getRecordStatus(r: { amount: number; cost: number }) {
  if (!r.amount) return { label: '売上未入力', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
  if (!r.cost) return { label: '原価未入力', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
  return { label: '入力済', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <circle cx="12" cy="13" r="3.25" strokeWidth={1.5} />
    </svg>
  )
}

function PhotoThumb({ url, count, onClick, size = 'w-14 h-14' }: { url?: string; count?: number; onClick?: (e: React.MouseEvent) => void; size?: string }) {
  if (!url) {
    return (
      <div className={`${size} rounded-lg shrink-0 bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-gray-300`}>
        <CameraIcon className="w-5 h-5" />
        <span className="text-[9px] mt-0.5 leading-none">写真なし</span>
      </div>
    )
  }
  return (
    <div className={`relative ${size} rounded-lg overflow-hidden shrink-0 bg-gray-100`} onClick={onClick}>
      <img src={url} alt="" className="w-full h-full object-cover" />
      {count !== undefined && count > 1 && (
        <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] leading-none px-1 py-0.5 rounded-tl">
          {count}
        </span>
      )}
    </div>
  )
}

export default function AdminSalesClient({ initialYearMonth, initialRecords, initialProfiles, initialPhotoCounts, initialPhotoThumbs }: AdminSalesClientProps) {
  const openSidebar = useSidebar()
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [records, setRecords] = useState<SalesWithProfile[]>(initialRecords)
  const [photoCounts, setPhotoCounts] = useState<Record<number, number>>(initialPhotoCounts)
  const [photoThumbs, setPhotoThumbs] = useState<Record<number, string>>(initialPhotoThumbs)
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ record?: SalesRecord | null; date?: string } | null>(null)
  const [page, setPage] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterUserId, setFilterUserId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'no_amount' | 'no_cost' | 'complete'>('all')
  const [filterPhoto, setFilterPhoto] = useState<'all' | 'has' | 'none'>('all')

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

  const filtered = records.filter(r => {
    if (filterUserId !== 'all' && r.user_id !== filterUserId) return false
    if (filterStatus !== 'all') {
      const status = !r.amount ? 'no_amount' : !r.cost ? 'no_cost' : 'complete'
      if (status !== filterStatus) return false
    }
    if (filterPhoto === 'has' && !(photoCounts[r.id] > 0)) return false
    if (filterPhoto === 'none' && photoCounts[r.id] > 0) return false
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const desc = (r.description || '').toLowerCase()
      const name = (r.profile?.name ?? '').toLowerCase()
      if (!desc.includes(q) && !name.includes(q)) return false
    }
    return true
  })

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0)
  const totalCost = filtered.reduce((s, r) => s + (r.cost ?? 0), 0)
  const totalProfit = totalAmount - totalCost
  const grossMarginRate = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : null

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedFiltered = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const isFiltered = searchQuery.trim() !== '' || filterUserId !== 'all' || filterStatus !== 'all' || filterPhoto !== 'all'

  const handleFilterChange = (fn: () => void) => {
    setPage(0)
    fn()
  }

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
  const goToday = () => {
    setPage(0)
    const d = new Date()
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={openSidebar} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-900">売上管理</h1>
        <button
          onClick={() => setModal({ date: new Date().toLocaleDateString('sv-SE') })}
          className="ml-auto px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow"
        >
          ＋ 売上報告を追加
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button onClick={prevMonth} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">‹ 前月</button>
        <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">今月</button>
        <button onClick={nextMonth} className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">次月 ›</button>
        <span className="text-base md:text-lg font-bold text-gray-900 ml-2">{yearMonth.replace('-', '年')}月</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-gray-500">売上</div>
          <div className="text-lg md:text-xl font-bold text-gray-900 mt-0.5">¥{totalAmount.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-gray-500">原価</div>
          <div className="text-lg md:text-xl font-bold text-gray-900 mt-0.5">¥{totalCost.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-gray-500">粗利</div>
          <div className="text-lg md:text-xl font-bold text-emerald-700 mt-0.5">¥{totalProfit.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3">
          <div className="text-xs text-gray-500">粗利率</div>
          <div className="text-lg md:text-xl font-bold text-emerald-700 mt-0.5">
            {grossMarginRate !== null ? `${grossMarginRate.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={e => handleFilterChange(() => setSearchQuery(e.target.value))}
          placeholder="案件名・現場名・担当者で検索"
          className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterUserId}
          onChange={e => handleFilterChange(() => setFilterUserId(e.target.value))}
          className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全担当者</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => handleFilterChange(() => setFilterStatus(e.target.value as typeof filterStatus))}
          className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">すべての状態</option>
          <option value="no_amount">売上未入力</option>
          <option value="no_cost">原価未入力</option>
          <option value="complete">入力済</option>
        </select>
        <select
          value={filterPhoto}
          onChange={e => handleFilterChange(() => setFilterPhoto(e.target.value as typeof filterPhoto))}
          className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">写真: すべて</option>
          <option value="has">写真あり</option>
          <option value="none">写真なし</option>
        </select>
      </div>

      {isFiltered && (
        <div className="text-xs text-gray-500 mb-2">{filtered.length}件 / 全{records.length}件</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">{isFiltered ? '条件に一致する記録がありません' : '記録がありません'}</div>
      ) : (
        <>
        {/* PC: 一覧表示 */}
        <div className="hidden lg:block border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="grid [grid-template-columns:64px_76px_1fr_112px_112px_112px_112px_100px_28px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500">
            <div>写真</div>
            <div>日付</div>
            <div>案件名・現場名</div>
            <div>担当者</div>
            <div className="text-right">売上</div>
            <div className="text-right">原価</div>
            <div className="text-right">粗利</div>
            <div>状態</div>
            <div />
          </div>
          <div className="divide-y divide-gray-100">
            {pagedFiltered.map(r => {
              const status = getRecordStatus(r)
              const profit = r.amount - (r.cost ?? 0)
              return (
                <div
                  key={r.id}
                  onClick={() => setModal({ record: r })}
                  className="grid [grid-template-columns:64px_76px_1fr_112px_112px_112px_112px_100px_28px] gap-2 items-center px-3 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <PhotoThumb
                    url={photoThumbs[r.id]}
                    count={photoCounts[r.id]}
                    size="w-12 h-12"
                    onClick={photoThumbs[r.id] ? (e => { e.stopPropagation(); setLightboxUrl(photoThumbs[r.id]) }) : undefined}
                  />
                  <div className="text-xs text-gray-500">{r.record_date.slice(5).replace('-', '/')}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate" title={r.description || undefined}>
                      {r.description || '（案件名未設定）'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 truncate">{r.profile?.name ?? '—'}</div>
                  <div className="text-right text-sm font-medium text-gray-900">{r.amount ? `¥${r.amount.toLocaleString()}` : <span className="text-gray-400 font-normal">—</span>}</div>
                  <div className="text-right text-sm text-gray-600">{r.cost ? `¥${r.cost.toLocaleString()}` : <span className="text-gray-400">—</span>}</div>
                  <div className="text-right text-sm font-medium text-emerald-700">{r.amount ? `¥${profit.toLocaleString()}` : <span className="text-gray-400 font-normal">—</span>}</div>
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="text-right text-gray-300">›</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* スマホ: カード表示 */}
        <div className="lg:hidden space-y-2">
          {pagedFiltered.map(r => {
            const status = getRecordStatus(r)
            const profit = r.amount - (r.cost ?? 0)
            return (
              <div
                key={r.id}
                onClick={() => setModal({ record: r })}
                className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate" title={r.description || undefined}>
                    {r.description || '（案件名未設定）'}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${status.cls}`}>{status.label}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <span>{r.record_date.slice(5).replace('-', '/')}</span>
                  <span>・</span>
                  <span>{r.profile?.name ?? '—'}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <PhotoThumb
                    url={photoThumbs[r.id]}
                    count={photoCounts[r.id]}
                    onClick={photoThumbs[r.id] ? (e => { e.stopPropagation(); setLightboxUrl(photoThumbs[r.id]) }) : undefined}
                  />
                  <div className="flex-1 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-[10px] text-gray-400">売上</div>
                      <div className="text-sm font-medium text-gray-900">{r.amount ? `¥${r.amount.toLocaleString()}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">原価</div>
                      <div className="text-sm text-gray-600">{r.cost ? `¥${r.cost.toLocaleString()}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">粗利</div>
                      <div className="text-sm font-medium text-emerald-700">{r.amount ? `¥${profit.toLocaleString()}` : '—'}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-right text-xs text-blue-600 font-medium">詳細を見る ›</div>
              </div>
            )
          })}
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
            <label className="block text-xs font-medium text-gray-700 mb-1">案件名・現場名</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="例：兵庫病院 LED更新工事"
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
