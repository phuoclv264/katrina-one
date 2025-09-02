
'use client';

import { db, storage } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTask } from 'firebase/storage';
import type { ShiftReport, TasksByShift, Staff, TaskCompletion, CompletionRecord } from './types';
import { tasksByShift as initialTasksByShift, staff as initialStaff } from './data';

// --- Tasks ---

let tasksUnsubscribe: () => void;

// Helper to convert Data URL to Blob
function dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(',');
    if (arr.length < 2) {
        throw new Error('Invalid data URL');
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Could not parse MIME type from data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}


export const dataStore = {
  subscribeToTasks(callback: (tasks: TasksByShift) => void): () => void {
    const docRef = doc(db, 'app-data', 'tasks');
    
    if (tasksUnsubscribe) {
      tasksUnsubscribe();
    }

    tasksUnsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as TasksByShift);
      } else {
        await setDoc(docRef, initialTasksByShift);
        callback(initialTasksByShift);
      }
    });

    return tasksUnsubscribe;
  },

  async updateTasks(newTasks: TasksByShift) {
    const docRef = doc(db, 'app-data', 'tasks');
    await setDoc(docRef, newTasks);
  },
  
  // --- Live Reports ---

  subscribeToReport(reportId: string, callback: (report: ShiftReport | null) => void): () => void {
    const docRef = doc(db, 'reports', reportId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
            ...data,
            id: docSnap.id,
            startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ShiftReport);
      } else {
        callback(null);
      }
    });
  },

  async getOrCreateReport(staffName: string, shiftKey: string): Promise<ShiftReport> {
    const today = new Date().toISOString().split('T')[0];
    const reportId = `${staffName}-${shiftKey}-${today}`;
    const reportRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(reportRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        startedAt: (data.startedAt as Timestamp)?.toDate().toISOString(),
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString(),
      } as ShiftReport
    } else {
      const newReport: Omit<ShiftReport, 'id'> = {
        staffName,
        shiftKey,
        status: 'ongoing',
        startedAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
        completedTasks: {},
        uploadedPhotos: [],
        issues: null,
      };
      await setDoc(reportRef, newReport);
      const createdDoc = await getDoc(reportRef);
      const data = createdDoc.data();
       return {
        ...data,
        id: createdDoc.id,
        startedAt: (data?.startedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        submittedAt: (data?.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as ShiftReport
    }
  },

  async updateReport(reportId: string, data: Partial<Omit<ShiftReport, 'completedTasks' | 'uploadedPhotos'>> | { completedTasks?: TaskCompletion, uploadedPhotos?: string[] }) {
      const reportRef = doc(db, 'reports', reportId);
      
      const updateData: any = {
          ...data,
          submittedAt: serverTimestamp() // Always update the last modified time
      };

      await updateDoc(reportRef, updateData);
  },

  subscribeToReports(callback: (reports: ShiftReport[]) => void): () => void {
     const reportsCollection = collection(db, 'reports');
     const q = query(reportsCollection, orderBy('submittedAt', 'desc'));

     const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const reports: ShiftReport[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            reports.push({
                ...data,
                id: doc.id,
                startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as ShiftReport);
        });
        callback(reports);
     });

     return unsubscribe;
  },
  
  async getReportById(reportId: string): Promise<ShiftReport | null> {
    const docRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            ...data,
            id: docSnap.id,
            startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ShiftReport;
    }
    return null;
  },
  
  // --- Staff ---
   async getStaff(): Promise<Staff[]> {
    const docRef = doc(db, 'app-data', 'staff');
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()){
        return docSnap.data().list as Staff[];
    } else {
        await setDoc(docRef, { list: initialStaff });
        return initialStaff;
    }
   },


  // --- Image Upload ---
  uploadPhotoWithProgress(
    photoDataUrl: string,
    reportId: string,
    taskId: string,
    onProgress: (progress: number) => void
  ): { task: UploadTask; promise: Promise<string> } {
    const uniqueId = `photo_${Date.now()}_${Math.random()}`;
    const storageRef = ref(storage, `reports/${reportId}/${taskId}/${uniqueId}.jpg`);
    const blob = dataURLtoBlob(photoDataUrl);

    const uploadTask = uploadBytesResumable(storageRef, blob);

    const promise = new Promise<string>((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                reject(error);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
            }
        );
    });

    return { task: uploadTask, promise };
  },

  async deletePhoto(photoUrl: string): Promise<void> {
    try {
        const photoRef = ref(storage, photoUrl);
        await deleteObject(photoRef);
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            console.warn(`Photo not found, could not delete: ${photoUrl}`);
            return;
        }
        throw error;
    }
  },
};
