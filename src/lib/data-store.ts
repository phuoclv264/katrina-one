
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
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import type { ShiftReport, TasksByShift, CompletionRecord } from './types';
import { tasksByShift as initialTasksByShift } from './data';
import { v4 as uuidv4 } from 'uuid';

const getTodaysDateKey = () => new Date().toISOString().split('T')[0];

const cleanupOldLocalStorage = () => {
    if (typeof window === 'undefined') return;
    const todayKey = getTodaysDateKey();
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('report-') && !key.includes(todayKey)) {
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

  async getOrCreateReport(userId: string, staffName: string, shiftKey: string): Promise<ShiftReport> {
    const date = getTodaysDateKey();
    const reportId = `report-${userId}-${shiftKey}-${date}`;
    const firestoreDocRef = doc(db, 'reports', reportId);

    const firestoreDocSnap = await getDoc(firestoreDocRef);

    if (firestoreDocSnap.exists()) {
        const data = firestoreDocSnap.data();
        const serverReport: ShiftReport = {
            ...data,
            id: firestoreDocSnap.id,
            startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || data.startedAt,
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
            lastSynced: (data.lastSynced as Timestamp)?.toDate().toISOString() || data.lastSynced,
        };
        // Always save the latest from server to local on start
        await this.saveLocalReport(serverReport);
        return serverReport;
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
    await this.saveLocalReport(newReport);
    return newReport;
  },

  async saveLocalReport(report: ShiftReport): Promise<void> {
     if (typeof window !== 'undefined') {
        localStorage.setItem(report.id, JSON.stringify(report));
    }
  },

  async syncReport(reportId: string): Promise<ShiftReport> {
     let reportString = localStorage.getItem(reportId);
     if (!reportString) throw new Error("Báo cáo không tìm thấy để đồng bộ.");

     let report: ShiftReport = JSON.parse(reportString);
     const firestoreRef = doc(db, 'reports', report.id);

     const reportToSync = JSON.parse(JSON.stringify(report));
     let allUploadedUrls: string[] = reportToSync.uploadedPhotos || [];

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
     reportToSync.lastSynced = serverTimestamp();
     
     const docExists = (await getDoc(firestoreRef)).exists();
     if (!docExists) {
         reportToSync.startedAt = Timestamp.fromDate(new Date(reportToSync.startedAt));
     } else {
         delete reportToSync.startedAt; // Don't overwrite startedAt on sync
     }
     
     // status remains 'ongoing'
     delete reportToSync.status; 


     await setDoc(firestoreRef, reportToSync, { merge: true });

     // Fetch the document again to get the server-generated timestamp
     const updatedDoc = await getDoc(firestoreRef);
     const updatedData = updatedDoc.data();
      const finalReport: ShiftReport = {
        ...report, // Start with original local report
        ...updatedData, // Overwrite with server data
        id: updatedDoc.id,
        completedTasks: reportToSync.completedTasks, // Use the one with updated URLs
        uploadedPhotos: reportToSync.uploadedPhotos,
        startedAt: (updatedData?.startedAt as Timestamp)?.toDate().toISOString() || report.startedAt,
        lastSynced: (updatedData?.lastSynced as Timestamp)?.toDate().toISOString(),
        status: 'ongoing', // Explicitly set status back
      };

     await this.saveLocalReport(finalReport);
     
     return finalReport;
  },

  subscribeToReports(callback: (reports: ShiftReport[]) => void): () => void {
     const reportsCollection = collection(db, 'reports');
     const q = query(reportsCollection, orderBy('startedAt', 'desc'));

     return onSnapshot(q, (querySnapshot) => {
        const reports: ShiftReport[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            reports.push({
                ...data,
                id: doc.id,
                startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || data.startedAt,
                submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
                lastSynced: (data.lastSynced as Timestamp)?.toDate().toISOString() || data.lastSynced,
            } as ShiftReport);
        });
        callback(reports);
     });
  },
};

    