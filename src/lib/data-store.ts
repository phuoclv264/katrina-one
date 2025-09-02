
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
if (typeof window !== 'undefined') {
    cleanupOldLocalStorage();
}


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
    
    // 2. If not in local, check Firestore for an existing report for today
    const firestoreDocRef = doc(db, 'reports', reportId);
    const firestoreDocSnap = await getDoc(firestoreDocRef);

    if (firestoreDocSnap.exists()) {
        const firestoreData = firestoreDocSnap.data() as ShiftReport;
        const report = {
             ...firestoreData,
             id: firestoreDocSnap.id,
             // Convert Firestore Timestamps to ISO strings for consistency
             startedAt: (firestoreData.startedAt as any)?.toDate ? (firestoreData.startedAt as any).toDate().toISOString() : firestoreData.startedAt,
             submittedAt: (firestoreData.submittedAt as any)?.toDate ? (firestoreData.submittedAt as any).toDate().toISOString() : firestoreData.submittedAt,
             lastSynced: (firestoreData.lastSynced as any)?.toDate ? (firestoreData.lastSynced as any).toDate().toISOString() : firestoreData.lastSynced,
        };
        // Save the fetched report to local storage to continue the session
        localStorage.setItem(reportId, JSON.stringify(report));
        return report;
    }

    // 3. If nothing exists anywhere, create a new local report
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
      let reportString = localStorage.getItem(reportId);
      if (!reportString) throw new Error("Báo cáo không tìm thấy để đồng bộ.");

      let report: ShiftReport = JSON.parse(reportString);

      // Set syncing state in UI
      report = { ...report, isSyncing: true };
      await this.saveLocalReport(report);
      
      try {
        const firestoreRef = doc(db, 'reports', report.id);
        // Create a deep copy for manipulation to avoid race conditions with React state
        const reportToSync = JSON.parse(JSON.stringify(report));

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
                        
                        // Add to master list if not already there
                        if (!allUploadedUrls.includes(downloadURL)) {
                           allUploadedUrls.push(downloadURL);
                        }
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
        // We convert startedAt back to a Timestamp if it's the first sync
        const docExists = (await getDoc(firestoreRef)).exists();
        if(!docExists) {
            reportToSync.startedAt = Timestamp.fromDate(new Date(reportToSync.startedAt));
        } else {
            delete reportToSync.startedAt; // Don't overwrite the original start time
        }
        
        await setDoc(firestoreRef, reportToSync, { merge: true });
        
        // Save the final, synced state back to local storage
        const finalReportState = { ...report, ...reportToSync, startedAt: new Date(report.startedAt).toISOString() };
        await this.saveLocalReport(finalReportState);
        return finalReportState;

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
     report.submittedAt = new Date().toISOString(); // Set local submitted time
     
     const firestoreRef = doc(db, 'reports', report.id);
     await updateDoc(firestoreRef, {
        status: 'submitted',
        submittedAt: serverTimestamp() // Use server time for final submission
     });

     // Save final state to local storage
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
        const data = docSnap.data();
        // Return the report regardless of status, the caller can decide what to do
        return {
            ...data,
            id: docSnap.id,
            startedAt: (data.startedAt as any)?.toDate ? (data.startedAt as any).toDate().toISOString() : data.startedAt,
            submittedAt: (data.submittedAt as any)?.toDate ? (data.submittedAt as any).toDate().toISOString() : data.submittedAt,
        } as ShiftReport;
    }
    return null;
  },
};
