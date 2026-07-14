import { SupabaseClient } from '@supabase/supabase-js'

export interface SalesPhotoSummary {
  counts: Record<number, number>
  thumbs: Record<number, string>
}

export async function getSalesPhotoSummary(
  supabase: SupabaseClient,
  recordIds: number[]
): Promise<SalesPhotoSummary> {
  const counts: Record<number, number> = {}
  const thumbs: Record<number, string> = {}
  if (recordIds.length === 0) return { counts, thumbs }

  const { data: photos } = await supabase
    .from('sales_photos')
    .select('sales_record_id, storage_path, created_at')
    .in('sales_record_id', recordIds)
    .order('created_at', { ascending: true })
  if (!photos) return { counts, thumbs }

  const firstPathByRecord: Record<number, string> = {}
  for (const p of photos) {
    counts[p.sales_record_id] = (counts[p.sales_record_id] ?? 0) + 1
    if (!(p.sales_record_id in firstPathByRecord)) firstPathByRecord[p.sales_record_id] = p.storage_path
  }

  const entries = Object.entries(firstPathByRecord)
  if (entries.length > 0) {
    const paths = entries.map(([, path]) => path)
    const { data: signed } = await supabase.storage.from('sales-photos').createSignedUrls(paths, 3600)
    signed?.forEach((s, i) => {
      if (s.signedUrl) thumbs[Number(entries[i][0])] = s.signedUrl
    })
  }

  return { counts, thumbs }
}
