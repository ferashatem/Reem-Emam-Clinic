import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadPhoto(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function uploadSessionPhotos(files: File[], sessionId: string): Promise<string[]> {
  const uploads = files.map((file, i) =>
    uploadPhoto(file, `session_reports/${sessionId}/${Date.now()}_${i}_${file.name}`)
  )
  return Promise.all(uploads)
}
