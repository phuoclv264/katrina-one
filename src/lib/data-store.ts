
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
  getDocs,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import type { ShiftReport, TasksByShift, CompletionRecord, TaskSection, InventoryItem, InventoryReport, ComprehensiveTask, ComprehensiveTaskSection } from './types';
import { tasksByShift as initialTasksByShift, bartenderTasks as initialBartenderTasks, inventoryList as initialInventoryList, comprehensiveTasks as initialComprehensiveTasks } from './data';
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
        if ((key.startsWith('report-') || key.startsWith('inventory-report-')) && !key.includes(todayKey)) {
            localStorage.removeItem(key);
        }
    });
};

// Run cleanup when the app loads
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
  
  subscribeToBartenderTasks(callback: (tasks: TaskSection[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'bartenderTasks');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().tasks as TaskSection[]);
      } else {
        await setDoc(docRef, { tasks: initialBartenderTasks });
        callback(initialBartenderTasks);
      }
    });
    return unsubscribe;
  },

  async updateBartenderTasks(newTasks: TaskSection[]) {
    const docRef = doc(db, 'app-data', 'bartenderTasks');
    await setDoc(docRef, { tasks: newTasks });
  },

  subscribeToComprehensiveTasks(callback: (tasks: ComprehensiveTaskSection[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'comprehensiveTasks');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().tasks as ComprehensiveTaskSection[]);
      } else {
        await setDoc(docRef, { tasks: initialComprehensiveTasks });
        callback(initialComprehensiveTasks);
      }
    });
    return unsubscribe;
  },
  
   async updateComprehensiveTasks(newTasks: ComprehensiveTaskSection[]) {
    const docRef = doc(db, 'app-data', 'comprehensiveTasks');
    await setDoc(docRef, { tasks: newTasks });
  },

  subscribeToInventoryList(callback: (items: InventoryItem[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'inventoryList');
     const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().items as InventoryItem[]);
      } else {
        await setDoc(docRef, { items: initialInventoryList });
        callback(initialInventoryList);
      }
    });
    return unsubscribe;
  },
  
  async updateInventoryList(newList: InventoryItem[]) {
    const docRef = doc(db, 'app-data', 'inventoryList');
    await setDoc(docRef, { items: newList });
  },
  
  /**
   * Retrieves or creates an inventory report for a given user for the current day.
   * This logic is simpler than the shift reports as it prioritizes local data to prevent loss of input.
   * It does not perform a complex version comparison.
   * 
   * @param userId - The ID of the current user.
   * @param staffName - The display name of the current user.
   * @returns A promise that resolves to the user's inventory report for the day.
   */
  async getOrCreateInventoryReport(userId: string, staffName: string): Promise<InventoryReport> {
    if (typeof window === 'undefined') {
       throw new Error("Cannot get report from server-side.");
    }
    const date = getTodaysDateKey();
    const reportId = `inventory-report-${userId}-${date}`;
    
    // 1. Prioritize local data: If a report is already in localStorage, use it immediately.
    const localReportString = localStorage.getItem(reportId);
    if(localReportString) {
        return JSON.parse(localReportString);
    }
    
    // 2. Check Firestore: If no local data, check if a report was submitted from another device.
    const firestoreRef = doc(db, 'inventory-reports', reportId);
    const serverDoc = await getDoc(firestoreRef);
    if (serverDoc.exists()) {
        const data = serverDoc.data();
        const report = {
            ...data,
            id: serverDoc.id,
            date,
            lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString(),
        } as InventoryReport;
        // Save the server version locally for future offline access.
        localStorage.setItem(reportId, JSON.stringify(report));
        return report;
    }

    // 3. Create new report: If no data exists anywhere, create a fresh report object.
    const newReport: InventoryReport = {
        id: reportId,
        userId,
        staffName,
        date,
        status: 'ongoing',
        stockLevels: {},
        suggestions: null,
        lastUpdated: new Date().toISOString(),
    };
    // Save to local storage immediately so subsequent inputs are not lost.
    await this.saveLocalInventoryReport(newReport);
    return newReport;
  },

  async saveLocalInventoryReport(report: InventoryReport): Promise<void> {
    if (typeof window !== 'undefined') {
       report.lastUpdated = new Date().toISOString();
       localStorage.setItem(report.id, JSON.stringify(report));
   }
 },

  async saveInventoryReport(report: InventoryReport): Promise<void> {
    if (typeof window === 'undefined') return;
    
    // Save to local storage first
    await this.saveLocalInventoryReport(report);
    
    // Then save to Firestore
    const reportToSubmit: Omit<InventoryReport, 'id'> & {lastUpdated: any, submittedAt?: any} = {
        ...report,
        lastUpdated: serverTimestamp(),
        submittedAt: report.submittedAt ? Timestamp.fromDate(new Date(report.submittedAt)) : undefined,
    };
    delete (reportToSubmit as any).id;

    const firestoreRef = doc(db, 'inventory-reports', report.id);
    await setDoc(firestoreRef, reportToSubmit, { merge: true });
  },

  /**
   * Retrieves or creates a shift/hygiene/comprehensive report, handling local and server data synchronization.
   * Determines the sync status by comparing `lastUpdated` timestamps.
   *
   * @param userId The ID of the current user.
   * @param staffName The display name of the current user.
   * @param shiftKey The key for the report type (e.g., 'sang', 'bartender_hygiene').
   * @returns A promise resolving to an object containing the report and its sync status.
   */
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
        let localReport: ShiftReport | null = localReportString ? JSON.parse(localReportString) : null;

        // Case 1: No data anywhere. Create a new in-memory report.
        if (!localReport && !serverDoc.exists()) {
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
        }

        // Case 2: Data on server, but not local (e.g., new device). Download from server.
        if (!localReport && serverDoc.exists()) {
             const serverReport = await this.overwriteLocalReport(reportId);
             return { report: serverReport, status: 'synced' };
        }
        
        // Case 3: Data on local, but not on server (e.g., offline work started). Local is newer.
        if(localReport && !serverDoc.exists()){
            return { report: localReport, status: 'local-newer' };
        }

        // Case 4: Data exists in both places. Compare timestamps.
        if (localReport && serverDoc.exists()) {
            const serverReportData = serverDoc.data() as ShiftReport;
            const serverLastUpdated = (serverReportData.lastUpdated as Timestamp)?.toDate().getTime() || 0;
            const localLastUpdated = new Date(localReport.lastUpdated as string).getTime();

            // If local is more than 1 second newer, it has unsynced changes.
            if (localLastUpdated > serverLastUpdated + 1000) { 
                return { report: localReport, status: 'local-newer' };
            // If server is more than 1 second newer, there's an update to download.
            } else if (serverLastUpdated > localLastUpdated + 1000) {
                return { report: localReport, status: 'server-newer' };
            // Otherwise, they are considered in sync.
            } else {
                return { report: localReport, status: 'synced' };
            }
        }
        
        // Fallback: Should ideally not be reached, but if it is, prioritize local report.
        if (localReport) {
            return { report: localReport, status: 'local-newer' };
        }

        // Final fallback: create a new report if all else fails.
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
        // Offline mode: If Firestore fetch fails, rely on local data.
        console.error("Firebase fetch failed, running in offline mode.", error);
        if (localReportString) {
             return { report: JSON.parse(localReportString), status: 'error' };
        }
        // If no local data and offline, create a new temporary report.
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
  
    const photosToUpload: {dataUri: string}[] = [];
    for (const taskId in reportToSubmit.completedTasks) {
      for (const completion of reportToSubmit.completedTasks[taskId]) {
        if (completion.photos) {
          for (const photo of completion.photos) {
            if (photo.startsWith('data:image')) {
              photosToUpload.push({ dataUri: photo });
            }
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
        if (completion.photos) {
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
    }
  
    reportToSubmit.uploadedPhotos = Array.from(urlSet);
    reportToSubmit.status = 'submitted';
    // We use serverTimestamp to ensure the "source of truth" for time is the server,
    // avoiding issues with client-side clock skew. The client's `startedAt` is converted
    // to a Firestore Timestamp for consistency.
    reportToSubmit.startedAt = Timestamp.fromDate(new Date(reportToSubmit.startedAt as string));
    reportToSubmit.submittedAt = serverTimestamp();
    reportToSubmit.lastUpdated = serverTimestamp();
    
    delete reportToSubmit.id;
  
    await setDoc(firestoreRef, reportToSubmit, { merge: true });
  
    // After successful submission, refetch the report from the server to get accurate timestamps
    const savedDoc = await getDoc(firestoreRef);
    const savedData = savedDoc.data();
    const finalReport: ShiftReport = {
        ...report, // keep local fields like id
        ...savedData,
        startedAt: (savedData?.startedAt as Timestamp).toDate().toISOString(),
        submittedAt: (savedData?.submittedAt as Timestamp).toDate().toISOString(),
        lastUpdated: (savedData?.lastUpdated as Timestamp).toDate().toISOString(),
    } as ShiftReport;

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

  subscribeToReports(callback: (reports: (ShiftReport | InventoryReport)[]) => void): () => void {
    let combinedReports: (ShiftReport | InventoryReport)[] = [];

    const shiftReportsCollection = collection(db, 'reports');
    const shiftQ = query(shiftReportsCollection, where('status', '==', 'submitted'));
    
    const inventoryReportsCollection = collection(db, 'inventory-reports');
    const inventoryQ = query(inventoryReportsCollection, where('status', '==', 'submitted'));

    const processResults = () => {
      // Sort after combining
        combinedReports.sort((a, b) => {
             const timeA = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
             const timeB = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
             return timeB - timeA;
        });
        callback(combinedReports);
    }

    const unsubscribeShift = onSnapshot(shiftQ, (querySnapshot) => {
        const shiftReports: ShiftReport[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                startedAt: (data.startedAt as Timestamp)?.toDate().toISOString() || data.startedAt,
                submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
                lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || data.lastUpdated,
            } as ShiftReport;
        });

        // Combine with inventory reports
        const otherReports = combinedReports.filter(r => !('shiftKey' in r));
        combinedReports = [...shiftReports, ...otherReports];
        processResults();
    });

    const unsubscribeInventory = onSnapshot(inventoryQ, (querySnapshot) => {
        const inventoryReports: InventoryReport[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
                lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || data.lastUpdated,
            } as InventoryReport;
        });
        
        // Combine with shift reports
        const otherReports = combinedReports.filter(r => 'shiftKey' in r);
        combinedReports = [...inventoryReports, ...otherReports];
        processResults();
    });

    return () => {
        unsubscribeShift();
        unsubscribeInventory();
    };
  },

  subscribeToReportsForShift(date: string, shiftKey: string, callback: (reports: ShiftReport[]) => void): () => void {
    const reportsCollection = collection(db, 'reports');
    const q = query(
      reportsCollection, 
      where('date', '==', date),
      where('shiftKey', '==', shiftKey),
      where('status', '==', 'submitted')
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
       reports.sort((a, b) => {
         const timeA = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
         const timeB = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
         return timeA - timeB;
       });
       callback(reports);
    }, (error) => {
      console.error("Error fetching reports for shift: ", error);
      callback([]);
    });
 },

  async getInventoryReportForDate(date: string): Promise<InventoryReport[]> {
    const reportsCollection = collection(db, 'inventory-reports');
    const q = query(reportsCollection, where('date', '==', date), where('status', '==', 'submitted'));
    const querySnapshot = await getDocs(q);
    const reports: InventoryReport[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        reports.push({
            ...data,
            id: doc.id,
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
            lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || data.lastUpdated,
        } as InventoryReport);
    });
    // Client-side sort
    reports.sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
      return timeB - timeA;
    });
    return reports;
  },

  async getHygieneReportForDate(date: string, shiftKey: string): Promise<ShiftReport[]> {
    const reportsCollection = collection(db, 'reports');
    const q = query(reportsCollection, where('date', '==', date), where('shiftKey', '==', shiftKey), where('status', '==', 'submitted'));
    const querySnapshot = await getDocs(q);
    const reports: ShiftReport[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        reports.push({
            ...data,
            id: doc.id,
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
            lastUpdated: (data.lastUpdated as Timestamp)?.toDate().toISOString() || data.lastUpdated,
        } as ShiftReport);
    });
     // Client-side sort
    reports.sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
      return timeB - timeA;
    });
    return reports;
  }
};

    

    
