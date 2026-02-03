'use client';

import { storage, auth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { MediaItem, MediaAttachment } from './types';
import { photoStore } from './photo-store';

/**
 * Tải một file lên Firebase Storage và trả về URL.
 * @param fileBlob Dữ liệu Blob của file.
 * @param path Đường dẫn lưu file trên Storage.
 * @returns URL của file đã tải lên.
 */
export async function uploadFile(fileBlob: Blob, path: string): Promise<string> {
  // Ensure we have an authenticated user (anonymous allowed) so storage rules that
  // require request.auth != null will permit the upload.
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error('Failed to sign in anonymously before upload:', e);
      // Let the upload attempt proceed; if auth is required the subsequent
      // uploadBytes will fail and the caller will receive the error.
    }
  }
    const storageRef = ref(storage, path);
    const metadata = {
        cacheControl: 'public,max-age=31536000,immutable',
    };
    await uploadBytes(storageRef, fileBlob, metadata);
    return getDownloadURL(storageRef);
}

/**
 * Xóa một file khỏi Firebase Storage bằng URL của nó.
 * @param fileUrl URL của file cần xóa.
 */
export async function deleteFileByUrl(fileUrl: string): Promise<void> {
    if (typeof window === 'undefined' || !fileUrl.includes('firebasestorage.googleapis.com')) return;
    try {
    if (!auth.currentUser) {
      try { await signInAnonymously(auth); } catch (e) { console.error('Failed to sign in anonymously before delete:', e); }
    }
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
            console.error("Lỗi khi xóa file từ Storage:", error);
        }
    }
}

export async function uploadMedia(mediaItems: MediaItem[], path: string): Promise<MediaAttachment[]> {
  // Ensure anonymous auth before batch uploads so storage rules allow writes
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch (e) { console.error('Failed to sign in anonymously before media upload:', e); }
  }
  const uploadPromises = mediaItems.map(async (item) => {
    const fileBlob = await photoStore.getPhoto(item.id);
    
    if (!fileBlob) {
        console.error(`Could not find media blob for item id ${item.id}.`);
        return null;
    }

    const fileRef = ref(storage, `${path}/${Date.now()}-${item.id}`);
    await uploadBytes(fileRef, fileBlob);
    const url = await getDownloadURL(fileRef);

    // After successful upload, delete from IndexedDB if it was a photo
    if (item.type === 'photo') {
      await photoStore.deletePhoto(item.id);
    }

    return {
      url,
      type: item.type,
    } as MediaAttachment;
  });

  return (await Promise.all(uploadPromises)).filter((att): att is MediaAttachment => att !== null);
}
