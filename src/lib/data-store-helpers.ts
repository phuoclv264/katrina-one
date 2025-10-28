'use client';

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Tải một file lên Firebase Storage và trả về URL.
 * @param fileBlob Dữ liệu Blob của file.
 * @param path Đường dẫn lưu file trên Storage.
 * @returns URL của file đã tải lên.
 */
export async function uploadFile(fileBlob: Blob, path: string): Promise<string> {
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
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
            console.error("Lỗi khi xóa file từ Storage:", error);
        }
    }
}
