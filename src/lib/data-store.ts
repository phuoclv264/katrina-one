
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
        if ((key.startsWith('report-') || key.startsWith('submitted-report-')) && !key.includes(todayKey)) {
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

  async getOrCreateReport(userId: string, staffName: string, shiftKey: string): Promise<{report: ShiftReport, hasUnsubmittedChanges: boolean}> {
    const date = getTodaysDateKey();
    const reportId = `report-${userId}-${shiftKey}-${date}`;
    const submittedReportId = `submitted-${reportId}`;
    
    if (typeof window === 'undefined') {
      throw new Error("Cannot create report on server.");
    }
    
    let report: ShiftReport;
    const localReportString = localStorage.getItem(reportId);
    
    if (localReportString) {
      report = JSON.parse(localReportString) as ShiftReport;
    } else {
      report = {
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
      await this.saveLocalReport(report);
    }

    const submittedReportString = localStorage.getItem(submittedReportId);
    // If there is a submitted version, compare it to the current working version.
    // If they are different, it means there are unsubmitted changes.
    const hasUnsubmittedChanges = submittedReportString ? submittedReportString !== JSON.stringify(report) : false;

    return { report, hasUnsubmittedChanges };
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

     const reportToSubmit = JSON.parse(JSON.stringify(report));
     let allUploadedUrls: string[] = [];

     for (const taskId in reportToSubmit.completedTasks) {
         for (const completion of reportToSubmit.completedTasks[taskId]) {
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
                     uploadedPhotosInCompletion.push(photo);
                     if (!allUploadedUrls.includes(photo)) {
                        allUploadedUrls.push(photo);
                     }
                 }
             }
             completion.photos = uploadedPhotosInCompletion;
         }
     }
     
     reportToSubmit.uploadedPhotos = allUploadedUrls;
     reportToSubmit.status = 'submitted';
     // Convert date strings back to Firebase Timestamp objects before sending
     reportToSubmit.startedAt = Timestamp.fromDate(new Date(reportToSubmit.startedAt));
     reportToSubmit.submittedAt = serverTimestamp();
     
     await setDoc(firestoreRef, reportToSubmit, { merge: true });

     // Update local report state after successful submission
     report.status = 'submitted';
     // Update the main report in local storage
     await this.saveLocalReport(report);
     
     // Also save a copy of the successfully submitted state
     if (typeof window !== 'undefined') {
        const submittedReportId = `submitted-${report.id}`;
        localStorage.setItem(submittedReportId, JSON.stringify(report));
     }
     
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
