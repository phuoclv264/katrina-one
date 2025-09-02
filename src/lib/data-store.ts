
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
import { v4 as uuidv4 } from 'uuid';

// --- Helper to convert Data URL to Blob ---
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
    const res = await fetch(dataurl);
    return await res.blob();
}


export const dataStore = {
  subscribeToTasks(callback: (tasks: TasksByShift) => void): () => void {
    const docRef = doc(db, 'app-data', 'tasks');
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as TasksByShift);
      } else {
        await setDoc(docRef, initialTasksByShift);
        callback(initialTasksByShift);
      }
    });

    return unsubscribe;
  },

  async updateTasks(newTasks: TasksByShift) {
    const docRef = doc(db, 'app-data', 'tasks');
    await setDoc(docRef, newTasks);
  },
  
  // --- Live Reports ---

  subscribeToReport(reportId: string, callback: (report: ShiftReport | null | undefined) => void): () => void {
    const docRef = doc(db, 'reports', reportId);
    callback(undefined); // Indicate loading has started
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
        callback(null); // Document does not exist
      }
    }, (error) => {
        console.error("Error subscribing to report:", error);
        callback(null); // On error, treat as not found
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
  
  async deletePreviousDayReportsAndPhotos() {
    const lastCleanup = localStorage.getItem('lastCleanupDate');
    const today = new Date().toISOString().split('T')[0];

    if (lastCleanup === today) {
        // console.log("Cleanup already ran today.");
        return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    
    const reportsCollection = collection(db, 'reports');
    const q = query(reportsCollection, where('submittedAt', '<=', Timestamp.fromDate(yesterday)));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log("No old reports to delete.");
            localStorage.setItem('lastCleanupDate', today);
            return;
        }

        const batch = writeBatch(db);

        for (const docSnap of querySnapshot.docs) {
            const report = docSnap.data() as ShiftReport;
            console.log(`Deleting report ${docSnap.id} and its photos...`);

            // Delete associated photos from Storage
            if (report.uploadedPhotos && report.uploadedPhotos.length > 0) {
                for (const photoUrl of report.uploadedPhotos) {
                    try {
                        if (photoUrl.startsWith('https://firebasestorage.googleapis.com')) {
                           const photoRef = ref(storage, photoUrl);
                           await deleteObject(photoRef);
                        }
                    } catch (error: any) {
                        if (error.code === 'storage/object-not-found') {
                            console.warn(`Photo not found in Storage, skipping delete: ${photoUrl}`);
                        } else {
                            console.error(`Failed to delete photo ${photoUrl}:`, error);
                        }
                    }
                }
            }
            
            // Add report deletion to the batch
            batch.delete(docSnap.ref);
        }

        // Commit all deletions
        await batch.commit();
        console.log(`Successfully deleted ${querySnapshot.size} old report(s).`);
        localStorage.setItem('lastCleanupDate', today);

    } catch (error) {
        console.error("Error deleting old reports: ", error);
    }
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
    const uniqueId = `photo_${uuidv4()}.jpg`;
    const storageRef = ref(storage, `reports/${reportId}/${taskId}/${uniqueId}`);
    
    const promise = new Promise<string>(async (resolve, reject) => {
        try {
            const blob = await dataURLtoBlob(photoDataUrl);
            const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

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
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        } catch(error) {
            console.error("Error creating blob or starting upload:", error);
            reject(error)
        }
    });

    // We can't return the uploadTask directly because it's created inside an async function.
    // The promise is the main way to interact with the result.
    // For cancellation, a more advanced setup would be needed (e.g., passing an AbortController).
    // For now, we return a mock task.
    const mockTask = {} as UploadTask;
    return { task: mockTask, promise };
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
