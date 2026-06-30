import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'
import { firestoreAddSalesPhoto, firestoreGetSalesPhotoById, firestoreDeleteSalesPhoto } from './firestore'

export async function uploadSalesPhoto(
  salesRecordId: number,
  file: File
): Promise<{ id: number; url: string; file_path: string; original_name: string }> {
  const filename = `${Date.now()}_${file.name}`
  const filePath = `sales/${salesRecordId}/${filename}`
  const storageRef = ref(storage, filePath)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  const id = await firestoreAddSalesPhoto({
    sales_record_id: salesRecordId,
    file_path: filePath,
    original_name: file.name,
    url,
  })
  return { id, url, file_path: filePath, original_name: file.name }
}

export async function deleteSalesPhoto(photoNumericId: number): Promise<void> {
  const photo = await firestoreGetSalesPhotoById(photoNumericId)
  if (photo && photo.file_path) {
    try {
      const storageRef = ref(storage, photo.file_path as string)
      await deleteObject(storageRef)
    } catch {
      // ignore if not found in storage
    }
  }
  await firestoreDeleteSalesPhoto(photoNumericId)
}
