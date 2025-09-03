
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
  where,
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
    
    const localReportString = localStorage.getItem(reportId);
    
    const firestoreRef = doc(db, 'reports', reportId);
    try {
        const serverDoc = await getDoc(firestoreRef);

        // Case 1: Brand new day. Nothing on local or server.
        if (!localReportString && !serverDoc.exists()) {
            const newReport: ShiftReport = {
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
            // Don't save it yet, only return the structure. It will be saved on first action.
            return { report: newReport, status: 'synced' };
        }

        let localReport: ShiftReport | null = localReportString ? JSON.parse(localReportString) : null;
        
        // If nothing on local, but something on server, create local from server version
        if (!localReport && serverDoc.exists()) {
             const serverReport = await this.overwriteLocalReport(reportId);
             return { report: serverReport, status: 'synced' };
        }
        
        // If something on local, but nothing on server, local is newer.
        if(localReport && !serverDoc.exists()){
            return { report: localReport, status: 'local-newer' };
        }

        // If we have both, we must compare.
        if (localReport && serverDoc.exists()) {
            const serverReportData = serverDoc.data() as ShiftReport;
            const serverLastUpdated = (serverReportData.lastUpdated as Timestamp)?.toDate().getTime() || 0;
            const localLastUpdated = new Date(localReport.lastUpdated as string).getTime();

            if (localLastUpdated > serverLastUpdated + 1000) { // Add 1s tolerance
                return { report: localReport, status: 'local-newer' };
            } else if (serverLastUpdated > localLastUpdated + 1000) {
                return { report: localReport, status: 'server-newer' };
            } else {
                return { report: localReport, status: 'synced' };
            }
        }
        
        // Fallback: This handles the case where local exists but server check fails/is weird. We trust local.
        if (localReport) {
            return { report: localReport, status: 'local-newer' };
        }

        // Final fallback: should be unreachable, but creates a new report structure.
         const newReport: ShiftReport = {
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
        return { report: newReport, status: 'synced' };


    } catch(error) {
        console.error("Firebase fetch failed, running in offline mode.", error);
        // If we can't reach the server, trust whatever is local or create new.
        if (localReportString) {
             return { report: JSON.parse(localReportString), status: 'error' };
        }
        const newReport: ShiftReport = {
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
        return { report: newReport, status: 'error' };
    }
  },

  async saveLocalReport(report: ShiftReport): Promise<void> {
     if (typeof window !== 'undefined') {
        report.lastUpdated = new Date().toISOString();
        localStorage.setItem(report.id, JSON.stringify(report));
    }
  },

  isReportEmpty(report: ShiftReport): boolean {
    const hasCompletedTasks = Object.keys(report.completedTasks).length > 0;
    const hasIssues = report.issues && report.issues.trim() !== '';
    return !hasCompletedTasks && !hasIssues;
  },

  async deleteLocalReport(reportId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(reportId);
    }
  },

  async submitReport(report: ShiftReport): Promise<void> {
    if (typeof window === 'undefined') throw new Error("Cannot submit report from server.");
  
    const firestoreRef = doc(db, 'reports', report.id);
    const reportToSubmit = JSON.parse(JSON.stringify(report));
  
    // --- Parallel Image Upload ---
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
  
    const uploadPromises = photosToUpload.map(({ dataUri }) => {
      const uniqueId = `photo_${uuidv4()}.jpg`;
      const storageRef = ref(storage, `reports/${report.date}/${report.staffName}/${uniqueId}`);
      return uploadString(storageRef, dataUri, 'data_url').then(snapshot => getDownloadURL(snapshot.ref));
    });
  
    const uploadedUrls = await Promise.all(uploadPromises);
  
    const dataUriToUrlMap = new Map<string, string>();
    photosToUpload.forEach((photo, index) => {
      dataUriToUrlMap.set(photo.dataUri, uploadedUrls[index]);
    });
  
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
    // This is an approximation. The real timestamps are on the server.
    // A full sync (overwriteLocalReport) would be more accurate but this is faster.
    const finalReport: ShiftReport = {
      ...reportToSubmit,
      startedAt: (reportToSubmit.startedAt as Timestamp).toDate().toISOString(),
      // We don't know the exact server timestamp, so we use local time as an approximation for the UI
      submittedAt: new Date().toISOString(), 
      lastUpdated: new Date().toISOString(), 
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
                lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || data.lastUpdated,
            } as ShiftReport);
        });
        callback(reports);
     });
  },

  subscribeToReportsForShift(date: string, shiftKey: string, callback: (reports: ShiftReport[]) => void): () => void {
    const reportsCollection = collection(db, 'reports');
    const q = query(
      reportsCollection, 
      where('date', '==', date),
      where('shiftKey', '==', shiftKey),
      orderBy('submittedAt', 'asc')
    );

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
    }, (error) => {
      console.error("Error fetching reports for shift: ", error);
      callback([]);
    });
 }
};
