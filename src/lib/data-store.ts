
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

// This function runs on app startup to clear out old reports.
const cleanupOldLocalStorage = () => {
    if (typeof window === 'undefined') return;
    const todayKey = getTodaysDateKey();
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('report-') && !key.includes(todayKey)) {
            localStorage.removeItem(key);
        }
    });
};

// Run the cleanup function when the dataStore is imported.
cleanupOldLocalStorage();


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
    
    if (typeof window === 'undefined') {
      // This should ideally not be called on the server.
      // Returning a dummy or empty report structure might be necessary
      // if server-side rendering is involved in this page.
      throw new Error("Cannot create report on server.");
    }
    
    // Always prioritize local data.
    const localReportString = localStorage.getItem(reportId);
    if (localReportString) {
      return JSON.parse(localReportString) as ShiftReport;
    }

    // If no local data, create a fresh report for today.
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

  async submitReport(reportId: string): Promise<ShiftReport> {
     if (typeof window === 'undefined') throw new Error("Cannot submit report from server.");
     
     let reportString = localStorage.getItem(reportId);
     if (!reportString) throw new Error("Báo cáo không tìm thấy để gửi đi.");

     let report: ShiftReport = JSON.parse(reportString);
     const firestoreRef = doc(db, 'reports', report.id);

     // Create a deep copy to avoid modifying the original object before it's fully processed
     const reportToSubmit = JSON.parse(JSON.stringify(report));
     let allUploadedUrls: string[] = [];

     // --- Upload Photos and Replace Data URIs with URLs ---
     for (const taskId in reportToSubmit.completedTasks) {
         for (const completion of reportToSubmit.completedTasks[taskId]) {
             const uploadedPhotosInCompletion: string[] = [];
             for (const photo of completion.photos) {
                 // Check if the photo is a data URI that needs uploading
                 if (photo.startsWith('data:image')) {
                     const uniqueId = `photo_${uuidv4()}.jpg`;
                     const storageRef = ref(storage, `reports/${report.date}/${report.staffName}/${uniqueId}`);
                     const snapshot = await uploadString(storageRef, photo, 'data_url');
                     const downloadURL = await getDownloadURL(snapshot.ref);
                     uploadedPhotosInCompletion.push(downloadURL);
                     allUploadedUrls.push(downloadURL);
                 } else {
                     // This case handles photos that might already be URLs (from a previous sync attempt)
                     uploadedPhotosInCompletion.push(photo);
                     if (!allUploadedUrls.includes(photo)) {
                        allUploadedUrls.push(photo);
                     }
                 }
             }
             completion.photos = uploadedPhotosInCompletion;
         }
     }
     
     // --- Prepare the final report object for Firestore ---
     reportToSubmit.uploadedPhotos = allUploadedUrls;
     reportToSubmit.status = 'submitted';
     reportToSubmit.submittedAt = serverTimestamp(); // Use server timestamp for accuracy
     // Convert string dates back to Firestore Timestamp objects where appropriate
     reportToSubmit.startedAt = Timestamp.fromDate(new Date(reportToSubmit.startedAt));
     
     // --- Submit to Firestore ---
     await setDoc(firestoreRef, reportToSubmit, { merge: true });

     // --- Update local report status to 'submitted' but DO NOT remove it ---
     report.status = 'submitted';
     await this.saveLocalReport(report);
     
     // Fetch the document again to get the server-generated timestamp for the return value
     const updatedDoc = await getDoc(firestoreRef);
     const updatedData = updatedDoc.data();
      const finalReport: ShiftReport = {
        ...updatedData,
        id: updatedDoc.id,
        startedAt: (updatedData?.startedAt as Timestamp)?.toDate().toISOString(),
        submittedAt: (updatedData?.submittedAt as Timestamp)?.toDate().toISOString(),
      } as ShiftReport;
     
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
