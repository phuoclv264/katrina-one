
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
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import type { ShiftReport, TasksByShift, Staff, TaskCompletion } from './types';
import { tasksByShift as initialTasksByShift, staff as initialStaff } from './data';

// --- Tasks ---

let tasksUnsubscribe: () => void;

export const dataStore = {
  subscribeToTasks(callback: (tasks: TasksByShift) => void): () => void {
    const docRef = doc(db, 'app-data', 'tasks');
    
    // Unsubscribe from previous listener if it exists
    if (tasksUnsubscribe) {
      tasksUnsubscribe();
    }

    tasksUnsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as TasksByShift);
      } else {
        // If no data in Firestore, initialize with default data
        await setDoc(docRef, initialTasksByShift);
        callback(initialTasksByShift);
      }
    });

    return tasksUnsubscribe;
  },

  async updateTasks(newTasks: TasksByShift) {
    const docRef = doc(db, 'app-data', 'tasks');
    await setDoc(docRef, newTasks);
  },

  // --- Reports ---

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
                // Convert Firestore Timestamp to ISO string
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
            submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ShiftReport;
    }
    return null;
  },

  async addOrUpdateReport(reportData: Omit<ShiftReport, 'id' | 'submittedAt'>) {
    const reportWithTimestamp = {
        ...reportData,
        submittedAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'reports'), reportWithTimestamp);
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
  async uploadPhoto(photoDataUrl: string, reportId: string, taskId: string): Promise<string> {
    const uniqueId = `photo_${Date.now()}_${Math.random()}`;
    const storageRef = ref(storage, `reports/${reportId}/${taskId}/${uniqueId}.jpg`);
    
    await uploadString(storageRef, photoDataUrl, 'data_url');
    
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
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
  
  // --- Daily Progress on Firestore ---
  subscribeToDailyProgress(key: string, callback: (completion: TaskCompletion | null) => void): () => void {
    const docRef = doc(db, 'daily-progress', key);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().taskCompletion as TaskCompletion);
        } else {
            // Document doesn't exist yet, provide null or an empty object
            callback(null);
        }
    });

    return unsubscribe;
  },

  async updateDailyProgress(key: string, completion: TaskCompletion) {
      const docRef = doc(db, 'daily-progress', key);
      await setDoc(docRef, { taskCompletion: completion }, { merge: true });
  },

  async clearDailyProgress(key: string) {
    const docRef = doc(db, 'daily-progress', key);
    // Instead of clearing, we can delete the document for the day
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        await deleteDoc(docRef);
    }
  }
};
