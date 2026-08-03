import { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'quotation-photos'

export async function uploadQuotationPhoto(supabase: SupabaseClient, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function removeQuotationPhoto(supabase: SupabaseClient, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export async function getQuotationPhotoSignedUrls(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  if (uniquePaths.length === 0) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(uniquePaths, 3600)
  const result: Record<string, string> = {}
  data?.forEach((d, i) => {
    if (d.signedUrl) result[uniquePaths[i]] = d.signedUrl
  })
  return result
}
