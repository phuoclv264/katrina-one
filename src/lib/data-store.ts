
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

const getTodaysDateKey = () => {
    const now = new Date();
    // Get date parts for Vietnam's timezone (UTC+7)
    const year = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' });
    const month = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit' });
    const day = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' });
    return `${year}-${month}-${day}`;
};

const cleanupOldLocalStorage = () => {
    if (typeof window === 'undefined') return;
    const todayKey = getTodaysDateKey();
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('report-') && !key.includes(todayKey)) {
            localStorage.removeItem(key);
            // Also remove the submitted copy for that old report
            if (key.startsWith('report-')) {
                const submittedKey = key.replace('report-', 'submitted-report-');
                localStorage.removeItem(submittedKey);
            }
        }
    });
};

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

  async getOrCreateReport(userId: string, staffName: string, shiftKey: string): Promise<{report: ShiftReport, status: 'synced' | 'local-newer' | 'server-newer' | 'error' }> {
    if (typeof window === 'undefined') {
       throw new Error("Cannot get report from server-side.");
    }

    const date = getTodaysDateKey();
    const reportId = `report-${userId}-${shiftKey}-${date}`;
    
    let localReport: ShiftReport | null = null;
    const localReportString = localStorage.getItem(reportId);
    if (localReportString) {
      localReport = JSON.parse(localReportString);
    } else {
      localReport = {
          id: reportId,
          userId,
          staffName,
          shiftKey,
          status: 'ongoing',
          date,
          startedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          completedTasks: {},
          issues: null,
          uploadedPhotos: [],
      };
      await this.saveLocalReport(localReport);
    }

    const firestoreRef = doc(db, 'reports', reportId);
    try {
        const serverDoc = await getDoc(firestoreRef);
        if (!serverDoc.exists()) {
             // If server doc doesn't exist, local is implicitly newer (or they are both new)
            return { report: localReport, status: 'local-newer' };
        }

        const serverReport = serverDoc.data() as ShiftReport;
        // Convert server timestamp to comparable format
        const serverLastUpdated = (serverReport.lastUpdated as Timestamp)?.toDate().getTime() || 0;
        const localLastUpdated = new Date(localReport.lastUpdated as string).getTime();

        if (localLastUpdated > serverLastUpdated + 1000) { // Add 1s tolerance
            return { report: localReport, status: 'local-newer' };
        } else if (serverLastUpdated > localLastUpdated + 1000) {
            // Server is newer, but we return the local version for the UI to decide
            // The UI will then call overwriteLocalReport if the user agrees
            return { report: localReport, status: 'server-newer' };
        } else {
            return { report: localReport, status: 'synced' };
        }
    } catch(error) {
        console.error("Firebase fetch failed, running in offline mode.", error);
        // If we can't reach the server, assume local is what we have.
        // The status can be used to show an offline indicator.
        return { report: localReport, status: 'error' };
    }
  },

  async saveLocalReport(report: ShiftReport): Promise<void> {
     if (typeof window !== 'undefined') {
        report.lastUpdated = new Date().toISOString();
        localStorage.setItem(report.id, JSON.stringify(report));
    }
  },

  async submitReport(report: ShiftReport): Promise<void> {
    if (typeof window === 'undefined') throw new Error("Cannot submit report from server.");
  
    const firestoreRef = doc(db, 'reports', report.id);
    const reportToSubmit = JSON.parse(JSON.stringify(report));
  
    // --- Parallel Image Upload ---
    // 1. Collect all photos that need uploading
    const photosToUpload: {dataUri: string}[] = [];
    for (const taskId in reportToSubmit.completedTasks) {
      for (const completion of reportToSubmit.completedTasks[taskId]) {
        for (const photo of completion.photos) {
          if (photo.startsWith('data:image')) {
            photosToUpload.push({ dataUri: photo });
          }
        }
      }
    }
  
    // 2. Create an array of upload promises
    const uploadPromises = photosToUpload.map(({ dataUri }) => {
      const uniqueId = `photo_${uuidv4()}.jpg`;
      const storageRef = ref(storage, `reports/${report.date}/${report.staffName}/${uniqueId}`);
      return uploadString(storageRef, dataUri, 'data_url').then(snapshot => getDownloadURL(snapshot.ref));
    });
  
    // 3. Execute all uploads in parallel
    const uploadedUrls = await Promise.all(uploadPromises);
  
    // 4. Create a map for easy lookup
    const dataUriToUrlMap = new Map<string, string>();
    photosToUpload.forEach((photo, index) => {
      dataUriToUrlMap.set(photo.dataUri, uploadedUrls[index]);
    });
  
    // 5. Replace data URIs with final URLs in the report object and collect all URLs
    let allUploadedUrls: string[] = report.uploadedPhotos || [];
    const urlSet = new Set<string>(allUploadedUrls);

    for (const taskId in reportToSubmit.completedTasks) {
      for (const completion of reportToSubmit.completedTasks[taskId]) {
        completion.photos = completion.photos.map((photo: string) => {
          if (photo.startsWith('data:image')) {
            const finalUrl = dataUriToUrlMap.get(photo)!;
            urlSet.add(finalUrl);
            return finalUrl;
          }
          // If it's already a URL, ensure it's in the set
          urlSet.add(photo);
          return photo;
        });
      }
    }
    // --- End of Parallel Upload Logic ---
  
    reportToSubmit.uploadedPhotos = Array.from(urlSet);
    reportToSubmit.status = 'submitted';
    reportToSubmit.startedAt = Timestamp.fromDate(new Date(reportToSubmit.startedAt as string));
    reportToSubmit.submittedAt = serverTimestamp();
    reportToSubmit.lastUpdated = serverTimestamp();
  
    await setDoc(firestoreRef, reportToSubmit, { merge: true });
  
    // After successful submission, update the local report to match
    const finalReport: ShiftReport = {
      ...reportToSubmit,
      startedAt: (reportToSubmit.startedAt as Timestamp).toDate().toISOString(),
      submittedAt: new Date().toISOString(), // Approximate client time
      lastUpdated: new Date().toISOString(), // Approximate client time
    };
    await this.saveLocalReport(finalReport);
  },

  async overwriteLocalReport(reportId: string): Promise<ShiftReport> {
    if (typeof window === 'undefined') throw new Error("Cannot overwrite local report from server.");
    const firestoreRef = doc(db, 'reports', reportId);
    const serverDoc = await getDoc(firestoreRef);

    if (!serverDoc.exists()) {
      throw new Error("Báo cáo không tồn tại trên máy chủ.");
    }

    const serverData = serverDoc.data();
    const serverReport: ShiftReport = {
      ...serverData,
      id: serverDoc.id,
      startedAt: (serverData.startedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      submittedAt: (serverData.submittedAt as Timestamp)?.toDate().toISOString(),
      lastUpdated: (serverData.lastUpdated as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    } as ShiftReport;
    
    localStorage.setItem(reportId, JSON.stringify(serverReport));
    return serverReport;
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
                lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || data.lastUpdated,
            } as ShiftReport);
        });
        callback(reports);
     });
  },
};
