
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
  deleteDoc,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject, type UploadTask } from 'firebase/storage';
import type { ShiftReport, TasksByShift, Staff, TaskCompletion, CompletionRecord } from './types';
import { tasksByShift as initialTasksByShift, staff as initialStaff } from './data';
import { v4 as uuidv4 } from 'uuid';


// --- Local Storage and Data Sync Logic ---

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

// Run cleanup once on app load
cleanupOldLocalStorage();

export const dataStore = {

  // --- Task Definitions (from Firestore) ---
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

  // --- Staff (from Firestore) ---
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

  // --- Report Management (Local First) ---

  async getOrCreateReport(staffName: string, shiftKey: string): Promise<ShiftReport> {
    const date = getTodaysDateKey();
    const reportId = `report-${staffName}-${shiftKey}-${date}`;
    
    // 1. Try to get from local storage first
    const localData = localStorage.getItem(reportId);
    if (localData) {
        return JSON.parse(localData);
    }
    
    // 2. If not in local, check if it was already submitted on Firestore
    const submittedReport = await this.getSubmittedReport(staffName, shiftKey, date);
    if (submittedReport) {
        // A report for this shift/day has already been submitted.
        // We save it locally to prevent re-creation and signal it's done.
        localStorage.setItem(reportId, JSON.stringify(submittedReport));
        return submittedReport;
    }

    // 3. If nothing exists, create a new local report
    const newReport: ShiftReport = {
        id: reportId,
        staffName,
        shiftKey,
        status: 'ongoing',
        date,
        startedAt: new Date().toISOString(),
        completedTasks: {},
        issues: null,
        uploadedPhotos: [], // Starts empty
    };
    localStorage.setItem(reportId, JSON.stringify(newReport));
    return newReport;
  },

  async saveLocalReport(report: ShiftReport): Promise<void> {
    localStorage.setItem(report.id, JSON.stringify(report));
  },
  
  async syncReport(reportId: string): Promise<ShiftReport> {
      let report: ShiftReport = JSON.parse(localStorage.getItem(reportId)!);
      if (!report) throw new Error("Báo cáo không tìm thấy để đồng bộ.");

      report = { ...report, isSyncing: true };
      await this.saveLocalReport(report);
      
      try {
        const firestoreRef = doc(db, 'reports', report.id);
        const reportToSync = JSON.parse(JSON.stringify(report)); // Deep copy

        let allUploadedUrls: string[] = reportToSync.uploadedPhotos || [];

        // Upload photos that are still data URIs
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
                        allUploadedUrls.push(downloadURL);
                    } else {
                        // It's already a URL, keep it
                        uploadedPhotosInCompletion.push(photo);
                    }
                }
                completion.photos = uploadedPhotosInCompletion;
            }
        }
        
        // Update report object with new URLs and sync time
        reportToSync.uploadedPhotos = allUploadedUrls;
        reportToSync.lastSynced = new Date().toISOString();
        delete reportToSync.isSyncing;

        // Use setDoc with merge: true to create or update
        await setDoc(firestoreRef, reportToSync, { merge: true });
        
        // Save the final, synced state back to local storage
        await this.saveLocalReport(reportToSync);
        return reportToSync;

      } catch (error) {
          console.error("Sync failed:", error);
          // Revert syncing state on failure
          report = { ...report, isSyncing: false };
          await this.saveLocalReport(report);
          throw error; // Re-throw to be caught by UI
      }
  },

  async submitReport(reportId: string): Promise<ShiftReport> {
     // First, ensure all data is synced
     let report = await this.syncReport(reportId);
     
     // Then, mark as submitted
     report.status = 'submitted';
     report.submittedAt = serverTimestamp(); // Use server time for final submission
     
     const firestoreRef = doc(db, 'reports', report.id);
     await setDoc(firestoreRef, {
        status: 'submitted',
        submittedAt: serverTimestamp()
     }, { merge: true });

     // Save final state to local storage
     report.submittedAt = new Date().toISOString(); // Approximate for local
     await this.saveLocalReport(report);
     
     return report;
  },

  // --- Firestore Read Functions (for Manager view, etc.) ---

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
                lastSynced: (data.lastSynced as Timestamp)?.toDate().toISOString() || data.lastSynced,
            } as ShiftReport);
        });
        callback(reports);
     });
  },
  
  async getSubmittedReport(staffName: string, shiftKey: string, date: string): Promise<ShiftReport | null> {
    const reportId = `report-${staffName}-${shiftKey}-${date}`;
    const docRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data() as ShiftReport;
        if(data.status === 'submitted') {
            return {
                ...data,
                id: docSnap.id,
                startedAt: (data.startedAt as any)?.toDate ? (data.startedAt as any).toDate().toISOString() : data.startedAt,
                submittedAt: (data.submittedAt as any)?.toDate ? (data.submittedAt as any).toDate().toISOString() : data.submittedAt,
            };
        }
    }
    return null;
  },
};
