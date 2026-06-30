import { firestoreAddSalesPhoto, firestoreGetSalesPhotoById, firestoreDeleteSalesPhoto } from './firestore'

// 画像をリサイズ＆圧縮してbase64に変換
async function compressImage(file: File, maxSize = 1024, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

export async function uploadSalesPhoto(
  salesRecordId: number,
  file: File
): Promise<{ id: number; url: string; file_path: string; original_name: string }> {
  const base64 = await compressImage(file)
  const id = await firestoreAddSalesPhoto({
    sales_record_id: salesRecordId,
    file_path: '',
    original_name: file.name,
    url: base64,
  })
  return { id, url: base64, file_path: '', original_name: file.name }
}

export async function deleteSalesPhoto(photoNumericId: number): Promise<void> {
  await firestoreDeleteSalesPhoto(photoNumericId)
}
