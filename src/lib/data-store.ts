

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
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { ShiftReport, TasksByShift, CompletionRecord } from './types';
import { tasksByShift as initialTasksByShift } from './data';
import { v4 as uuidv4 } from 'uuid';

const getTodaysDateKey = () => new Date().toISOString().split('T')[0];

const cleanupOldLocalStorage = () => {
    if (typeof window === 'undefined') return;
    const todayKey = getTodaysDateKey();
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('report-') && !key.endsWith(todayKey)) {
            localStorage.removeItem(key);
        }
    });
};

if (typeof window !== 'undefined') {
    cleanupOldLocalStorage();
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

  // Fetches from server or creates a new local report.
  // This is the source of truth when a shift starts.
  async getOrCreateReport(userId: string, staffName: string, shiftKey: string): Promise<ShiftReport> {
    const date = getTodaysDateKey();
    const reportId = `report-${userId}-${shiftKey}-${date}`;
    const firestoreDocRef = doc(db, 'reports', reportId);
    const firestoreDocSnap = await getDoc(firestoreDocRef);

    if (firestoreDocSnap.exists()) {
      const data = firestoreDocSnap.data();
      return {
        ...data,
        id: firestoreDocSnap.id,
        startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || data.startedAt,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
      } as ShiftReport;
    }
    
    // If nothing on server, create a new local report
    const newReport: ShiftReport = {
        id: reportId,
        userId,
        staffName,
        shiftKey,
        status: 'ongoing',
        date,
        startedAt: new Date().toISOString(),
        completedTasks: {},
        issues: null,
        uploadedPhotos: [],
    };
    return newReport;
  },

  async saveLocalReport(report: ShiftReport): Promise<void> {
    localStorage.setItem(report.id, JSON.stringify(report));
  },

  async submitReport(reportId: string): Promise<ShiftReport> {
     let reportString = localStorage.getItem(reportId);
     if (!reportString) throw new Error("Báo cáo không tìm thấy để gửi đi.");

     let report: ShiftReport = JSON.parse(reportString);
     const firestoreRef = doc(db, 'reports', report.id);

     // Create a deep copy for manipulation to avoid race conditions with React state
     const reportToSync = JSON.parse(JSON.stringify(report));
     let allUploadedUrls: string[] = reportToSync.uploadedPhotos || [];

     // Sequentially upload photos that are still data URIs
     for (const taskId in reportToSync.completedTasks) {
         for (const completion of reportToSync.completedTasks[taskId]) {
             const uploadedPhotosInCompletion: string[] = [];
             for (const photo of completion.photos) {
                 if (photo.startsWith('data:image')) {
                     const uniqueId = `photo_${uuidv4()}.jpg`;
                     const storageRef = ref(storage, `reports/${report.date}/${report.staffName}/${uniqueId}`);
                     const snapshot = await uploadString(storageRef, photo, 'data_url');
                     const downloadURL = await getDownloadURL(snapshot.ref);
                     uploadedPhotosInCompletion.push(downloadURL);
                     if (!allUploadedUrls.includes(downloadURL)) {
                        allUploadedUrls.push(downloadURL);
                     }
                 } else {
                     uploadedPhotosInCompletion.push(photo);
                 }
             }
             completion.photos = uploadedPhotosInCompletion;
         }
     }
     
     reportToSync.uploadedPhotos = allUploadedUrls;
     reportToSync.status = 'submitted';
     reportToSync.submittedAt = serverTimestamp();
     
     const docExists = (await getDoc(firestoreRef)).exists();
     if (!docExists) {
         reportToSync.startedAt = Timestamp.fromDate(new Date(reportToSync.startedAt));
     } else {
         delete reportToSync.startedAt;
     }

     await setDoc(firestoreRef, reportToSync, { merge: true });
     
     // Remove from local storage after successful submission
     localStorage.removeItem(reportId);
     
     return reportToSync; // Return the final state
  },

  subscribeToReports(callback: (reports: ShiftReport[]) => void): () => void {
     const reportsCollection = collection(db, 'reports');
     const q = query(reportsCollection, orderBy('submittedAt', 'desc'));

     return onSnapshot(q, (querySnapshot) => {
        const reports: ShiftReport[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            reports.push({
                ...data,
                id: doc.id,
                startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || data.startedAt,
                submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
            } as ShiftReport);
        });
        callback(reports);
     });
  },
};
