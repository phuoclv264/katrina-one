'use client';

import type { CashHandoverReport, FinalHandoverDetails } from './types';
import { db, auth, storage } from './firebase';
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
  addDoc,
  limit,
  deleteDoc,
  writeBatch,
  runTransaction,
  or,
  and,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { ShiftReport, TasksByShift, CompletionRecord, TaskSection, InventoryItem, InventoryReport, ComprehensiveTaskSection, Suppliers, ManagedUser, Violation, AppSettings, ViolationCategory, DailySummary, Task, Schedule, AssignedShift, Notification, UserRole, AssignedUser, InventoryOrderSuggestion, ShiftTemplate, Availability, TimeSlot, ViolationComment, AuthUser, ExpenseSlip, IncidentReport, RevenueStats, ExpenseItem, ExpenseType, OtherCostCategory, UnitDefinition, IncidentCategory, PaymentMethod, Product, GlobalUnit, PassRequestPayload, IssueNote, ViolationCategoryData, FineRule, PenaltySubmission, ViolationUserCost, MediaAttachment, CashCount, ExtractHandoverDataOutput, AttendanceRecord } from './types';
import { tasksByShift as initialTasksByShift, bartenderTasks as initialBartenderTasks, inventoryList as initialInventoryList, suppliers as initialSuppliers, initialViolationCategories, defaultTimeSlots, initialOtherCostCategories, initialIncidentCategories, initialProducts, initialGlobalUnits } from './data';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from './photo-store';
import { getISOWeek, startOfMonth, endOfMonth, eachWeekOfInterval, getYear, format, eachDayOfInterval, startOfWeek, endOfWeek, getDay, addDays, parseISO, isPast, isWithinInterval } from 'date-fns';
import { hasTimeConflict, getActiveShifts } from './schedule-utils';
import isEqual from 'lodash.isequal';
import * as scheduleStore from './schedule-store';
import * as attendanceStore from './attendance-store';
import * as idbKeyvalStore from './idb-keyval-store';
import * as cashierStore from './cashier-store';
import { deleteFileByUrl, uploadFile } from './data-store-helpers';


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
    // Cleanup localStorage
    for (const key of Object.keys(localStorage)) {
        if ((key.startsWith('report-') || key.startsWith('inventory-report-')) && !key.includes(todayKey)) {
            localStorage.removeItem(key);
        }
    }
    // Cleanup IndexedDB for handover reports
    idbKeyvalStore.keys().then((allKeys) => {
        for (const key of allKeys) {
            if (typeof key === 'string' && key.startsWith('handover-report-') && !key.includes(todayKey)) {
                idbKeyvalStore.del(key);
            }
        }
    }).catch(err => console.error("Failed to perform IndexedDB cleanup for handover reports:", err));
};

// Run cleanup when the app loads
if (typeof window !== 'undefined') {
    cleanupOldLocalStorage();
}

// Also clean up old photos from IndexedDB
// This will run when the app first loads the dataStore file.
photoStore.cleanupOldPhotos();

const severityOrder: Record<ViolationCategory['severity'], number> = {
    low: 1,
    medium: 2,
    high: 3,
};


export const dataStore = {
    ...scheduleStore, // Spread all functions from schedule-store
    ...attendanceStore, // Spread all functions from attendance-store
    ...cashierStore, // Spread all functions from cashier-store
    
    // --- Global Units ---
    subscribeToGlobalUnits(callback: (units: GlobalUnit[]) => void): () => void {
        const docRef = doc(db, 'app-data', 'unitDefinitions');
        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data().units as GlobalUnit[]);
            } else {
                try {
                    await setDoc(docRef, { units: initialGlobalUnits });
                    callback(initialGlobalUnits);
                } catch(e) {
                    console.error("Permission denied to create default global units.", e);
                    callback(initialGlobalUnits);
                }
            }
        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read global units: ${error.code}`);
            callback(initialGlobalUnits);
        });
        return unsubscribe;
    },

    async updateGlobalUnits(newUnits: GlobalUnit[]): Promise<void> {
        const docRef = doc(db, 'app-data', 'unitDefinitions');
        await setDoc(docRef, { units: newUnits });
    },

    // --- Products ---
    subscribeToProducts(callback: (products: Product[]) => void): () => void {
        const docRef = doc(db, 'app-data', 'products');
        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data().list as Product[]);
            } else {
                try {
                    await setDoc(docRef, { list: initialProducts });
                    callback(initialProducts);
                } catch(e) {
                    console.error("Permission denied to create default products.", e);
                    callback(initialProducts);
                }
            }
        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read products: ${error.code}`);
            callback(initialProducts);
        });
        return unsubscribe;
    },

    async updateProducts(newProducts: Product[]): Promise<void> {
        const docRef = doc(db, 'app-data', 'products');
        await setDoc(docRef, { list: newProducts });
    },

    async cleanupOldReports(daysToKeep: number): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
        let deletedCount = 0;

        // Query and delete old shift reports
        const shiftReportsQuery = query(
            collection(db, "reports"),
            where("submittedAt", "<", cutoffTimestamp)
        );
        const shiftReportsSnapshot = await getDocs(shiftReportsQuery);
        for (const reportDoc of shiftReportsSnapshot.docs) {
            await this.deleteShiftReport(reportDoc.id);
            deletedCount++;
        }
        
        return deletedCount;
    },

    async getDailySummary(date: string): Promise<DailySummary | null> {
        const docRef = doc(db, 'summaries', date);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                id: docSnap.id,
                generatedAt: (data.generatedAt as Timestamp)?.toDate()?.toISOString() || new Date().toISOString(),
            } as DailySummary;
        }
        return null;
    },

    async saveDailySummary(date: string, summary: string): Promise<void> {
        const docRef = doc(db, 'summaries', date);
        const data: Omit<DailySummary, 'id'> = {
            summary,
            generatedAt: serverTimestamp() as Timestamp,
        };
        await setDoc(docRef, data);
    },

    subscribeToIssueNotes(callback: (notes: IssueNote[]) => void): () => void {
        const q = query(collection(db, 'issue_notes'), orderBy('date', 'desc'), limit(100));
        return onSnapshot(q, (snapshot) => {
            const notes = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
            } as IssueNote));
            callback(notes);
        });
    },

    async scanAndSaveIssueNotes(): Promise<number> {
        const appSettings = await this.getAppSettings();
        const lastScanDate = appSettings.lastIssueNoteScan ? new Date(appSettings.lastIssueNoteScan as string) : new Date(0);
        
        const q = query(
            collection(db, 'reports'), 
            where('status', '==', 'submitted'),
            where('submittedAt', '>', lastScanDate),
            orderBy('submittedAt') 
        );

        const querySnapshot = await getDocs(q);
        const newNotes: Omit<IssueNote, 'id'>[] = [];

        querySnapshot.forEach(doc => {
            const report = doc.data() as ShiftReport;
            if (report.issues && report.issues.trim() !== '') {
                newNotes.push({
                    reportId: doc.id,
                    date: report.date,
                    shiftKey: report.shiftKey,
                    shiftName: report.shiftKey, // This is a simplification, may need a map
                    staffName: report.staffName,
                    note: report.issues.trim(),
                    scannedAt: serverTimestamp() as Timestamp,
                });
            }
        });

        if (newNotes.length > 0) {
            const batch = writeBatch(db);
            newNotes.forEach(note => {
                const docRef = doc(collection(db, 'issue_notes'));
                batch.set(docRef, note);
            });
            await batch.commit();
        }

        // Update the last scan date
        await this.updateAppSettings({ lastIssueNoteScan: new Date().toISOString() });

        return newNotes.length;
    },

    subscribeToAppSettings(callback: (settings: AppSettings) => void): () => void {
        const docRef = doc(db, 'app-data', 'settings');
        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data() as AppSettings);
            } else {
                // If settings don't exist, create them with registration enabled by default
                const defaultSettings: AppSettings = { isRegistrationEnabled: true };
                try {
                    await setDoc(docRef, defaultSettings);
                    callback(defaultSettings);
                } catch(e) {
                    console.error("Permission denied to create default app settings.", e);
                    callback(defaultSettings); // callback with default if creation fails
                }
            }
        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read app settings: ${error.code}`);
            callback({ isRegistrationEnabled: false }); // Default to disabled on error
        });
        return unsubscribe;
    },

    async getAppSettings(): Promise<AppSettings> {
        try {
            const docRef = doc(db, 'app-data', 'settings');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as AppSettings;
            } else {
                // Return default settings if document doesn't exist
                return { isRegistrationEnabled: true };
            }
        } catch (error) {
            console.error("Error fetching app settings on demand:", error);
            // On error, default to disabled for safety
            return { isRegistrationEnabled: false };
        }
    },

    async updateAppSettings(newSettings: Partial<AppSettings>): Promise<void> {
        const docRef = doc(db, 'app-data', 'settings');
        await updateDoc(docRef, newSettings);
    },
  
  subscribeToUsers(callback: (users: ManagedUser[]) => void): () => void {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, orderBy('displayName'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const users: ManagedUser[] = [];
      querySnapshot.forEach((doc) => {
        users.push({
            ...doc.data(),
            uid: doc.id,
        } as ManagedUser);
      });
      callback(users);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read users list: ${error.code}`);
        callback([]);
    });
    return unsubscribe;
  },
  
  async updateUserData(uid: string, data: Partial<ManagedUser>): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, data);
  },

  async bulkUpdateUserRates(rates: { [userId: string]: number }): Promise<void> {
    const batch = writeBatch(db);
    for (const userId in rates) {
        const userRef = doc(db, 'users', userId);
        batch.update(userRef, { hourlyRate: rates[userId] });
    }
    await batch.commit();
  },

  async deleteUser(uid: string): Promise<void> {
    
    // 1. Find and delete all reports by this user
    const reportsQuery = query(collection(db, "reports"), where("userId", "==", uid));
    const reportsSnapshot = await getDocs(reportsQuery);
    for (const reportDoc of reportsSnapshot.docs) {
      const reportData = reportDoc.data() as ShiftReport;
      // Delete associated photos
      if (reportData.completedTasks) {
        for (const taskId in reportData.completedTasks) {
          for (const completion of reportData.completedTasks[taskId]) {
            if (completion.photos) {
              for (const photoUrl of completion.photos) {
                await this.deletePhotoFromStorage(photoUrl);
              }
            }
          }
        }
      }
      await deleteDoc(doc(db, "reports", reportDoc.id));
    }

    // 2. Find and delete all inventory reports by this user
    const inventoryReportsQuery = query(collection(db, "inventory-reports"), where("userId", "==", uid));
    const inventoryReportsSnapshot = await getDocs(inventoryReportsQuery);
    for (const reportDoc of inventoryReportsSnapshot.docs) {
        const reportData = reportDoc.data() as InventoryReport;
        if(reportData.stockLevels) {
          for(const itemId in reportData.stockLevels) {
            const record = reportData.stockLevels[itemId];
            if(record.photos) {
              for (const photoUrl of record.photos) {
                await this.deletePhotoFromStorage(photoUrl);
              }
            }
          }
        }
      await deleteDoc(doc(db, "inventory-reports", reportDoc.id));
    }
    
    // 3. Delete the user document itself
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
  },

  subscribeToTasks(callback: (tasks: TasksByShift) => void): () => void {
    const docRef = doc(db, 'app-data', 'tasks');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as TasksByShift);
      } else {
        try {
            await setDoc(docRef, initialTasksByShift);
            callback(initialTasksByShift);
        } catch (e) {
            console.error("Permission denied to create default tasks.", e);
            callback(initialTasksByShift);
        }
      }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read server tasks: ${error.code}`);
        callback(initialTasksByShift);
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
        const sections = docSnap.data().tasks as TaskSection[];
        const sanitizedSections = sections.map(section => ({
            ...section,
            tasks: section.tasks.map((task: Task) => ({
                ...task,
                type: task.type || 'photo'
            }))
        }));
        callback(sanitizedSections);
      } else {
        try {
            await setDoc(docRef, { tasks: initialBartenderTasks });
            callback(initialBartenderTasks);
        } catch(e) {
            console.error("Permission denied to create default bartender tasks.", e);
            callback(initialBartenderTasks);
        }
      }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read bartender tasks: ${error.code}`);
        callback(initialBartenderTasks);
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
        try {
            await setDoc(docRef, { tasks: [] });
            callback([]);
        } catch(e) {
            console.error("Permission denied to create default comprehensive tasks.", e);
            callback([]);
        }
      }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read comprehensive tasks: ${error.code}`);
        callback([]);
    });
    return unsubscribe;
  },
  
   async updateComprehensiveTasks(newTasks: ComprehensiveTaskSection[]) {
    const docRef = doc(db, 'app-data', 'comprehensiveTasks');
    await setDoc(docRef, { tasks: newTasks });
  },

  async getInventoryList(): Promise<InventoryItem[]> {
    const docRef = doc(db, 'app-data', 'inventoryList');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const items = docSnap.data().items as InventoryItem[];
        return items.map(item => ({
            ...item,
            supplier: item.supplier ?? 'Chưa xác định',
            category: item.category ?? 'CHƯA PHÂN LOẠI',
            dataType: item.dataType || 'number',
            listOptions: item.listOptions || ['hết', 'gần hết', 'còn đủ', 'dư xài'],
            baseUnit: item.baseUnit || (item as any).unit || 'cái',
            units: (item.units && item.units.length > 0) ? item.units : [{ name: item.baseUnit || (item as any).unit || 'cái', isBaseUnit: true, conversionRate: 1 }]
        }));
    }
    return initialInventoryList;
  },

  subscribeToInventoryList(callback: (items: InventoryItem[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'inventoryList');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        let items = (docSnap.data().items || []) as InventoryItem[];
        // If the list is empty, restore from default
        if (items.length === 0) {
            console.warn("Inventory list is empty. Restoring from default.");
            await setDoc(docRef, { items: initialInventoryList });
            items = initialInventoryList;
        }

        const sanitizedItems = items.map(item => {
          const baseUnit = item.baseUnit || (item as any).unit || 'cái';
          const units = (item.units && item.units.length > 0) ? item.units : [{ name: baseUnit, isBaseUnit: true, conversionRate: 1 }];
          return {
            ...item,
            shortName: item.shortName || item.name.split(' ').slice(0, 2).join(' '),
            baseUnit,
            units,
            supplier: item.supplier ?? 'Chưa xác định',
            category: item.category ?? 'CHƯA PHÂN LOẠI',
            dataType: item.dataType || 'number',
            listOptions: item.listOptions || ['hết', 'gần hết', 'còn đủ', 'dư xài'],
          };
        });
        callback(sanitizedItems);
      } else {
        try {
            await setDoc(docRef, { items: initialInventoryList });
            callback(initialInventoryList);
        } catch(e) {
            console.error("Permission denied to create default inventory list.", e);
            callback(initialInventoryList);
        }
      }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read inventory list: ${error.code}`);
        callback(initialInventoryList);
    });
    return unsubscribe;
  },
  
  async updateInventoryList(newList: InventoryItem[]) {
    const docRef = doc(db, 'app-data', 'inventoryList');
    await setDoc(docRef, { items: newList });
  },

  subscribeToSuppliers(callback: (suppliers: string[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'suppliers');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if(docSnap.exists()) {
            callback(docSnap.data().list as string[]);
        } else {
            try {
                await setDoc(docRef, { list: initialSuppliers });
                callback(initialSuppliers);
            } catch(e) {
                console.error("Permission denied to create default suppliers list.", e);
                callback(initialSuppliers);
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read suppliers list: ${error.code}`);
        callback(initialSuppliers);
    });
    return unsubscribe;
  },
  async getSuppliers(): Promise<string[]> {
    const docRef = doc(db, 'app-data', 'suppliers');
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()){
      return docSnap.data().list as string[];
    }
    return initialSuppliers;
  },

  async updateSuppliers(newSuppliers: string[]) {
    const docRef = doc(db, 'app-data', 'suppliers');
    await setDoc(docRef, { list: newSuppliers });
  },
  
  async getOrCreateInventoryReport(userId: string, staffName: string): Promise<{ report: InventoryReport, isLocal: boolean }> {
    if (typeof window === 'undefined') {
       throw new Error("Cannot get report from server-side.");
    }
    const date = getTodaysDateKey();
    const reportId = `inventory-report-${userId}-${date}`;
    
    const localReportString = localStorage.getItem(reportId);
    if (localReportString) {
        return { report: JSON.parse(localReportString), isLocal: true };
    }
    
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
    
    return { report: newReport, isLocal: false };
  },

  async saveLocalInventoryReport(report: InventoryReport): Promise<void> {
      if (typeof window !== 'undefined') {
       report.lastUpdated = new Date().toISOString();
       localStorage.setItem(report.id, JSON.stringify(report));
   }
 },

  async saveInventoryReport(report: InventoryReport): Promise<void> {
    if (typeof window === 'undefined') return;

    const reportToSubmit = JSON.parse(JSON.stringify(report));

    // Handle photo uploads
    const photoIdsToUpload = new Set<string>();
    for (const itemId in reportToSubmit.stockLevels) {
        const record = reportToSubmit.stockLevels[itemId];
        if (record.photoIds) {
            record.photoIds.forEach((id: string) => photoIdsToUpload.add(id));
        }
    }
    const uploadPromises = Array.from(photoIdsToUpload).map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) return { photoId, downloadURL: null };
        const storageRef = ref(storage, `inventory-reports/${report.date}/${report.staffName}/${photoId}.jpg`);
        const metadata = {
            cacheControl: 'public,max-age=31536000,immutable',
        };
        await uploadBytes(storageRef, photoBlob, metadata);
        return { photoId, downloadURL: await getDownloadURL(storageRef) };
    });
    const uploadResults = await Promise.all(uploadPromises);
    const photoIdToUrlMap = new Map(uploadResults.filter((r): r is { photoId: string; downloadURL: string } => !!r.downloadURL).map(r => [r.photoId, r.downloadURL]));

    for (const itemId in reportToSubmit.stockLevels) {
        const record = reportToSubmit.stockLevels[itemId];
        if (record.photoIds) {
            const finalUrls = record.photoIds.map((id: string) => photoIdToUrlMap.get(id)).filter(Boolean);
            record.photos = Array.from(new Set([...(record.photos || []), ...finalUrls]));
            delete record.photoIds;
        }
    }

    // Finalize report data
    reportToSubmit.lastUpdated = serverTimestamp();
    reportToSubmit.submittedAt = serverTimestamp();
    delete reportToSubmit.id;

    // Commit all changes
    const firestoreRef = doc(db, 'inventory-reports', report.id);
    await setDoc(firestoreRef, reportToSubmit, { merge: true });

    // Cleanup local data
    await photoStore.deletePhotos(Array.from(photoIdsToUpload));
    if (typeof window !== 'undefined') {
        localStorage.removeItem(report.id);
    }
  },


  async updateInventoryReportSuggestions(reportId: string, suggestions: InventoryOrderSuggestion): Promise<void> {
    const reportRef = doc(db, 'inventory-reports', reportId);
    await updateDoc(reportRef, {
        suggestions: suggestions,
        lastUpdated: serverTimestamp(),
    });
  },

  async deleteInventoryReport(reportId: string): Promise<void> {
    const reportRef = doc(db, 'inventory-reports', reportId);
    const reportSnap = await getDoc(reportRef);

    if (!reportSnap.exists()) {
      console.warn(`Inventory report with ID ${reportId} not found.`);
      return;
    }

    const reportData = reportSnap.data() as InventoryReport;

    // Delete associated photos from Firebase Storage
    if (reportData.stockLevels) {
      for (const itemId in reportData.stockLevels) {
        const record = reportData.stockLevels[itemId];
        if (record.photos && record.photos.length > 0) {
          for (const photoUrl of record.photos) {
            await this.deletePhotoFromStorage(photoUrl);
          }
        }
      }
    }

    // Delete the report document from Firestore
    await deleteDoc(reportRef);
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
        let localReport: ShiftReport | null = localReportString ? JSON.parse(localReportString) : null;

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
            };
            return { report: newReport, status: 'synced' };
        }

        if (!localReport && serverDoc.exists()) {
             const serverReport = await this.overwriteLocalReport(userId, shiftKey);
             return { report: serverReport, status: 'synced' };
        }
        
        if(localReport && !serverDoc.exists()){
            return { report: localReport, status: 'local-newer' };
        }

        if (localReport && serverDoc.exists()) {
            const serverReportData = serverDoc.data() as ShiftReport;
            const serverLastUpdated = (serverReportData.lastUpdated as Timestamp)?.toDate().getTime() || 0;
            const localLastUpdated = new Date(localReport.lastUpdated as string).getTime();

            if (localLastUpdated > serverLastUpdated + 1000) { 
                return { report: localReport, status: 'local-newer' };
            } else if (serverLastUpdated > localLastUpdated + 1000) {
                return { report: localReport, status: 'server-newer' };
            } else {
                return { report: localReport, status: 'synced' };
            }
        }
        
        if (localReport) {
            return { report: localReport, status: 'local-newer' };
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
        };
        return { report: newReport, status: 'synced' };


    } catch(error) {
        console.error("Firebase fetch failed, running in offline mode.", error);
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
    const hasCompletedTasks = Object.keys(report.completedTasks).some(key => report.completedTasks[key]?.length > 0);
    const hasIssues = report.issues && report.issues.trim() !== '';
    return !hasCompletedTasks && !hasIssues;
  },

  async deleteLocalReport(reportId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(reportId);
    }
  },

  async deletePhotoFromStorage(photoUrl: string): Promise<void> {
    if (typeof window === 'undefined' || !photoUrl.includes('firebasestorage.googleapis.com')) return;
    try {
        const photoRef = ref(storage, photoUrl);
        await deleteObject(photoRef);
    } catch(error: any) {
        if(error.code !== 'storage/object-not-found') {
            console.error("Error deleting photo from Firebase Storage:", error);
        }
    }
  },
  
  async deleteShiftReport(reportId: string): Promise<void> {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);

    if (!reportSnap.exists()) {
      console.warn(`Shift report with ID ${reportId} not found.`);
      return;
    }

    const reportData = reportSnap.data() as ShiftReport;

    // Delete associated photos
    if (reportData.completedTasks) {
      const deletePhotoPromises: Promise<void>[] = [];
      for (const taskId in reportData.completedTasks) {
        for (const completion of reportData.completedTasks[taskId]) {
          if (completion.photos) {
            for (const photoUrl of completion.photos) {
              deletePhotoPromises.push(this.deletePhotoFromStorage(photoUrl));
            }
          }
        }
      }
      await Promise.all(deletePhotoPromises);
    }

    // Delete the report document
    await deleteDoc(reportRef);
  },

  async submitReport(report: ShiftReport): Promise<void> {
    if (typeof window === 'undefined') throw new Error("Cannot submit report from server.");
  
    const firestoreRef = doc(db, 'reports', report.id);
    const reportToSubmit = JSON.parse(JSON.stringify(report));
  
    const photoIdsToUpload = new Set<string>();
    for (const taskId in reportToSubmit.completedTasks) {
      for (const completion of reportToSubmit.completedTasks[taskId] as CompletionRecord[]) {
        if (completion.photoIds) {
          completion.photoIds.forEach(id => photoIdsToUpload.add(id));
        }
      }
    }
    
    const uploadPromises = Array.from(photoIdsToUpload).map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) {
            console.warn(`Photo with ID ${photoId} not found in local store.`);
            return { photoId, downloadURL: null };
        }
        const storageRef = ref(storage, `reports/${report.date}/${report.staffName}/${photoId}.jpg`);
        const metadata = {
          cacheControl: 'public,max-age=31536000,immutable',
        };
        await uploadBytes(storageRef, photoBlob, metadata);
        const downloadURL = await getDownloadURL(storageRef);
        return { photoId, downloadURL };
    });

    const uploadResults = await Promise.all(uploadPromises);
    const photoIdToUrlMap = new Map<string, string>();
    uploadResults.forEach(result => {
        if (result.downloadURL) {
            photoIdToUrlMap.set(result.photoId, result.downloadURL);
        }
    });

    for (const taskId in reportToSubmit.completedTasks) {
      for (const completion of reportToSubmit.completedTasks[taskId] as CompletionRecord[]) {
        const finalUrls = (completion.photoIds || [])
            .map(id => photoIdToUrlMap.get(id))
            .filter((url): url is string => !!url);
        
        completion.photos = Array.from(new Set([...(completion.photos || []), ...finalUrls]));
        delete completion.photoIds; 
      }
    }
  
    reportToSubmit.status = 'submitted';
    reportToSubmit.startedAt = Timestamp.fromDate(new Date(reportToSubmit.startedAt as string));
    reportToSubmit.submittedAt = serverTimestamp();
    reportToSubmit.lastUpdated = serverTimestamp();
    
    delete reportToSubmit.id;
  
    await setDoc(firestoreRef, reportToSubmit);
  
    await photoStore.deletePhotos(Array.from(photoIdsToUpload));
  },
  
  async overwriteLocalReport(arg1: string, arg2?: string): Promise<ShiftReport> {
    if (typeof window === 'undefined') throw new Error("Cannot overwrite local report from server.");
    
    let reportId: string;
    if (arg2) {
      const date = getTodaysDateKey();
      reportId = `report-${arg1}-${arg2}-${date}`;
    } else {
      reportId = arg1;
    }
    
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

        const otherReports = combinedReports.filter(r => !('shiftKey' in r));
        combinedReports = [...shiftReports, ...otherReports];
        processResults();
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read shift reports: ${error.code}`);
        const otherReports = combinedReports.filter(r => !('shiftKey' in r));
        combinedReports = [...otherReports];
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
        
        const otherReports = combinedReports.filter(r => 'shiftKey' in r);
        combinedReports = [...inventoryReports, ...otherReports];
        processResults();
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read inventory reports: ${error.code}`);
        const otherReports = combinedReports.filter(r => 'shiftKey' in r);
        combinedReports = [...otherReports];
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
         const timeB = a.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
         return timeA - timeB;
       });
       callback(reports);
    }, (error) => {
      console.error(`[Firestore Read Error] Could not read reports for shift ${shiftKey}: ${error.code}`);
      callback([]);
    });
 },

  async getInventoryReportForDate(date: string): Promise<InventoryReport[]> {
    try {
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
        reports.sort((a, b) => {
          const timeA = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
          const timeB = a.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
          return timeB - timeA;
        });
        return reports;
    } catch (error: any) {
        console.warn(`[Firestore Read Error] Could not read inventory reports for date ${date}: ${error.code}`);
        return [];
    }
  },

  subscribeToAllInventoryReports(callback: (reports: InventoryReport[]) => void): () => void {
    const reportsCollection = collection(db, 'inventory-reports');
    const q = query(reportsCollection, where('status', '==', 'submitted'), orderBy('submittedAt', 'desc'));
    
    return onSnapshot(q, (querySnapshot) => {
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
        callback(reports);
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read all inventory reports: ${error.code}`);
        callback([]);
    });
  },

  async getHygieneReportForDate(date: string, shiftKey: string): Promise<ShiftReport[]> {
    try {
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
        reports.sort((a, b) => {
          const timeA = a.submittedAt ? new Date(a.submittedAt as string).getTime() : 0;
          const timeB = a.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
          return timeB - timeA;
        });
        return reports;
    } catch (error: any) {
        console.warn(`[Firestore Read Error] Could not read hygiene reports for date ${date}: ${error.code}`);
        return [];
    }
  },

   subscribeToViolations(callback: (violations: Violation[]) => void): () => void {
    const violationsQuery = query(collection(db, 'violations'), orderBy('createdAt', 'desc'));
    const categoriesDocRef = doc(db, 'app-data', 'violationCategories');

    let cachedCategories: ViolationCategoryData | null = null;
    let cachedViolations: Violation[] = [];
    let isInitialViolationsLoad = true;

    const processAndCallback = async () => {
        if (!cachedCategories || cachedViolations.length === 0) {
          if (!isInitialViolationsLoad) callback(cachedViolations);
          return;
        };

        const currentMonthStart = startOfMonth(new Date());
        const currentMonthEnd = endOfMonth(new Date());

        const violationsInMonth = cachedViolations.filter(v => {
            if (!v.createdAt) return false;
            const createdAtDate = parseISO(v.createdAt as string);
            return isWithinInterval(createdAtDate, { start: currentMonthStart, end: currentMonthEnd });
        });

        const batch = writeBatch(db);
        let hasUpdates = false;

        const updatedViolationsMap = new Map(cachedViolations.map(v => {
            // Data migration for old penaltyPhotos field
            if ('penaltyPhotos' in v && v.penaltyPhotos && !v.penaltySubmissions) {
              const firstUser = v.users[0];
              if (firstUser) {
                return [v.id, {
                  ...v,
                  penaltySubmissions: [{
                    userId: firstUser.id,
                    userName: firstUser.name,
                    photos: v.penaltyPhotos as string[],
                    submittedAt: (v as any).penaltySubmittedAt || v.createdAt,
                  }]
                }];
              }
            }
            return [v.id, v];
        }));
        
        violationsInMonth.forEach(violation => {
            const { cost: newCost, severity: newSeverity, userCosts: newUserCosts } = this.calculateViolationCost(violation, cachedCategories!, violationsInMonth);
            const currentViolationState = updatedViolationsMap.get(violation.id)!;
    
            if (currentViolationState.cost !== newCost || currentViolationState.severity !== newSeverity || !isEqual(currentViolationState.userCosts, newUserCosts)) {
                const docRef = doc(db, 'violations', violation.id);
                batch.update(docRef, { cost: newCost, severity: newSeverity, userCosts: newUserCosts });
                updatedViolationsMap.set(violation.id, { ...currentViolationState, cost: newCost, severity: newSeverity, userCosts: newUserCosts });
                hasUpdates = true;
            }
        });
        
        const finalViolationList = Array.from(updatedViolationsMap.values());

        if (hasUpdates) {
             callback(finalViolationList);
            try {
                await batch.commit();
                // The onSnapshot listener for violations will then fetch the updated data naturally.
            } catch (err) {
                console.error("Error batch updating violation costs:", err);
            }
        } else {
             callback(finalViolationList);
        }
    };

    const unsubCategories = onSnapshot(categoriesDocRef, (docSnap) => {
        if (docSnap.exists()) {
            cachedCategories = docSnap.data() as ViolationCategoryData;
            if (!isInitialViolationsLoad) {
                processAndCallback();
            }
        }
    });

    const unsubViolations = onSnapshot(violationsQuery, (violationsSnapshot) => {
        cachedViolations = violationsSnapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? (data.createdAt as Timestamp).toDate().toISOString() : new Date(0).toISOString();
            return {
                id: doc.id,
                ...data,
                createdAt,
                penaltySubmittedAt: data.penaltySubmittedAt ? (data.penaltySubmittedAt as Timestamp).toDate().toISOString() : undefined,
            } as unknown as Violation;
        });
        isInitialViolationsLoad = false;
        processAndCallback();
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read violations: ${error.code}`);
        callback([]);
    });

    return () => {
        unsubCategories();
        unsubViolations();
    };
  },

  async recalculateViolationsForCurrentMonth(): Promise<void> {
    const categoryData = await this.getViolationCategories();
    
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const violationsQuery = query(
        collection(db, 'violations'),
        where('createdAt', '>=', monthStart),
        where('createdAt', '<=', monthEnd)
    );

    const violationsSnapshot = await getDocs(violationsQuery);
    if (violationsSnapshot.empty) return;

    const allViolationsInMonth = violationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate()?.toISOString() || new Date(0).toISOString(),
        } as Violation;
    }).sort((a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());
    
    const batch = writeBatch(db);
    let hasUpdates = false;

    allViolationsInMonth.forEach(violation => {
        const { cost: newCost, severity: newSeverity, userCosts: newUserCosts } = this.calculateViolationCost(violation, categoryData, allViolationsInMonth);
        const hasChanged = violation.cost !== newCost || violation.severity !== newSeverity || !isEqual(violation.userCosts, newUserCosts);
        
        if (hasChanged) {
            const docRef = doc(db, 'violations', violation.id);
            batch.update(docRef, { cost: newCost, severity: newSeverity, userCosts: newUserCosts });
            hasUpdates = true;
        }
    });

    if (hasUpdates) {
        try {
            await batch.commit();
        } catch (err) {
            console.error("Error recalculating and batch updating violation costs:", err);
        }
    }
  },
  
  subscribeToViolationCategories(callback: (data: ViolationCategoryData) => void): () => void {
    const docRef = doc(db, 'app-data', 'violationCategories');
    const defaultData: ViolationCategoryData = { 
        list: initialViolationCategories, 
        generalRules: [],
        generalNote: '',
    };
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            callback({
                list: (data.list || initialViolationCategories) as ViolationCategory[],
                generalRules: (data.generalRules || []) as FineRule[],
            });
        } else {
            try {
                await setDoc(docRef, defaultData);
                callback(defaultData);
            } catch(e) {
                console.error("Permission denied to create default violation categories.", e);
                callback(defaultData);
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read violation categories: ${error.code}`);
        callback(defaultData);
    });
    return unsubscribe;
  },

  async getViolationCategories(): Promise<ViolationCategoryData> {
    const docRef = doc(db, 'app-data', 'violationCategories');
    const docSnap = await getDoc(docRef);
     if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            list: (data.list || initialViolationCategories) as ViolationCategory[],
            generalRules: (data.generalRules || []) as FineRule[],
        };
    }
    return { list: initialViolationCategories, generalRules: [] };
  },

  async updateViolationCategories(newData: Partial<ViolationCategoryData>): Promise<void> {
    const docRef = doc(db, 'app-data', 'violationCategories');
    const currentData = await this.getViolationCategories();
    
    let updatedList = newData.list || currentData.list;
    updatedList = updatedList.map(category => {
      const sanitized: Partial<ViolationCategory> = { ...category };
      if (sanitized.calculationType === 'fixed') {
        sanitized.finePerUnit = sanitized.finePerUnit ?? 0;
        sanitized.unitLabel = sanitized.unitLabel ?? null;
      } else { 
        sanitized.fineAmount = sanitized.fineAmount ?? 0;
      }
      return {
        id: sanitized.id!, name: sanitized.name!, severity: sanitized.severity || 'low',
        calculationType: sanitized.calculationType || 'fixed', fineAmount: sanitized.fineAmount || 0,
        finePerUnit: sanitized.finePerUnit || 0, unitLabel: sanitized.unitLabel || 'phút',
      };
    });

    const dataToSave = {
        list: updatedList,
        generalRules: newData.generalRules !== undefined ? newData.generalRules : currentData.generalRules,
    };
    
    await setDoc(docRef, dataToSave, { merge: true });
    // After saving, trigger a recalculation
    await this.recalculateViolationsForCurrentMonth();
  },

  calculateViolationCost(
    violation: Violation,
    categoryData: ViolationCategoryData,
    allHistoricViolationsInMonth: Violation[]
  ): { cost: number; severity: Violation['severity']; userCosts: ViolationUserCost[] } {
    const category = categoryData.list.find(c => c.id === violation.categoryId);
    if (!category) {
        return { cost: violation.cost || 0, severity: violation.severity || 'low', userCosts: violation.userCosts || [] };
    }

    const baseCost = category.calculationType === 'perUnit'
        ? (category.finePerUnit || 0) * (violation.unitCount || 0)
        : (category.fineAmount || 0);

    let totalCost = 0;
    const userCosts: ViolationUserCost[] = [];

    violation.users.forEach(user => {
        let userFine = baseCost;
        let userSeverity = category.severity;
        
        const violationCreatedAt = violation.createdAt ? parseISO(violation.createdAt as string) : new Date(0);
        if (violationCreatedAt.getTime() === 0) {
            userCosts.push({ userId: user.id, cost: userFine, severity: userSeverity });
            totalCost += userFine;
            return;
        };

        const sortedRules = (categoryData.generalRules || []).sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
        
        for (const rule of sortedRules) {
            let ruleApplies = false;
            if (rule.condition === 'is_flagged' && violation.isFlagged) {
                ruleApplies = true;
            } else if (rule.condition === 'repeat_in_month') {
                const repeatCount = allHistoricViolationsInMonth.filter(v =>
                    v.id !== violation.id && // Exclude the current violation from the count
                    v.users.some(vu => vu.id === user.id) &&
                    v.categoryId === violation.categoryId &&
                    isWithinInterval(parseISO(v.createdAt as string), { start: startOfMonth(violationCreatedAt), end: endOfMonth(violationCreatedAt) }) &&
                    new Date(v.createdAt as string) < violationCreatedAt
                ).length + 1; // +1 to count the current one

                if (repeatCount >= rule.threshold) {
                    ruleApplies = true;
                }
            }
            
            if (ruleApplies) {
                if (rule.action === 'multiply') {
                    userFine *= rule.value;
                } else if (rule.action === 'add') {
                    userFine += rule.value;
                }
                
                if (rule.severityAction === 'increase') {
                    if (userSeverity === 'low') userSeverity = 'medium';
                    else if (userSeverity === 'medium') userSeverity = 'high';
                } else if (rule.severityAction === 'set_to_high') {
                    userSeverity = 'high';
                }
            }
        }
        
        userCosts.push({ userId: user.id, cost: userFine, severity: userSeverity });
        totalCost += userFine;
    });

    const finalSeverity = userCosts.reduce((maxSeverity, userCost) => {
        return severityOrder[userCost.severity] > severityOrder[maxSeverity] ? userCost.severity : maxSeverity;
    }, category.severity);

    return { cost: totalCost, severity: finalSeverity, userCosts };
  },

  async addOrUpdateViolation(
      data: Omit<Violation, 'id' | 'createdAt' | 'photos' | 'penaltySubmissions' | 'cost' | 'severity'> & { photosToUpload: string[] },
      id?: string
  ): Promise<void> {
    const { photosToUpload, ...violationData } = data;
    
    const uploadPromises = photosToUpload.map(async (photoId) => {
      const photoBlob = await photoStore.getPhoto(photoId);
      if (!photoBlob) return null;
      const storageRef = ref(storage, `violations/${data.reporterId}/${uuidv4()}.jpg`);
      const metadata = {
            cacheControl: 'public,max-age=31536000,immutable',
        };
      await uploadBytes(storageRef, photoBlob, metadata);
      return getDownloadURL(storageRef);
    });
    const photoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);
    
    const finalData: Partial<Violation> = { ...violationData };

    if (id) {
        const docRef = doc(db, 'violations', id);
        const currentDoc = await getDoc(docRef);
        if (currentDoc.exists()) {
            const existingPhotos = currentDoc.data().photos || [];
            finalData.photos = [...existingPhotos, ...photoUrls];
            finalData.lastModified = serverTimestamp() as Timestamp;
            await updateDoc(docRef, finalData);
        }
    } else {
        finalData.createdAt = serverTimestamp() as Timestamp;
        finalData.photos = photoUrls;
        await addDoc(collection(db, 'violations'), finalData);
    }

    await photoStore.deletePhotos(photosToUpload);
    await this.recalculateViolationsForCurrentMonth();
  },
  
  async deleteViolation(violation: Violation): Promise<void> {
    const allPhotoUrls: string[] = [];
    if (violation.photos && Array.isArray(violation.photos)) {
        allPhotoUrls.push(...violation.photos);
    }
    if (violation.penaltySubmissions) {
        violation.penaltySubmissions.forEach(sub => {
            if (sub.media && Array.isArray(sub.media)) {
                allPhotoUrls.push(...sub.media.map(m => m.url));
            } else if (sub.photos && Array.isArray(sub.photos)) {
                allPhotoUrls.push(...sub.photos);
            }
        });
    }
    if (violation.comments) {
      violation.comments.forEach(comment => {
        if (comment.photos) {
          allPhotoUrls.push(...comment.photos);
        }
      });
    }

    if (allPhotoUrls.length > 0) {
      const deletePhotoPromises = allPhotoUrls.map(url => this.deletePhotoFromStorage(url));
      await Promise.all(deletePhotoPromises);
    }
    
    const violationRef = doc(db, 'violations', violation.id);
    await deleteDoc(violationRef);
  },

  async toggleViolationFlag(violationId: string, currentState: boolean): Promise<void> {
    const violationRef = doc(db, 'violations', violationId);
    await updateDoc(violationRef, {
      isFlagged: !currentState
    });
    // After changing flag, trigger recalculation
    await this.recalculateViolationsForCurrentMonth();
  },

  async toggleViolationPenaltyWaived(violationId: string, currentState: boolean): Promise<void> {
    const violationRef = doc(db, 'violations', violationId);
    await updateDoc(violationRef, {
      isPenaltyWaived: !currentState
    });
  },

  async addCommentToViolation(violationId: string, comment: Omit<ViolationComment, 'id' | 'createdAt' | 'photos'>, photoIds: string[]): Promise<void> {
    // 1. Upload photos
    const uploadPromises = photoIds.map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) return null;
        const storageRef = ref(storage, `violations/${violationId}/comments/${uuidv4()}.jpg`);
        const metadata = {
            cacheControl: 'public,max-age=31536000,immutable',
        };
        await uploadBytes(storageRef, photoBlob, metadata);
        return getDownloadURL(storageRef);
    });
    const photoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);

    // 2. Create the full comment object
    const newComment: ViolationComment = {
      ...comment,
      id: uuidv4(),
      photos: photoUrls,
      createdAt: new Date().toISOString(),
    };

    // 3. Update the violation document
    const violationRef = doc(db, 'violations', violationId);
    await updateDoc(violationRef, {
      comments: arrayUnion(newComment)
    });
    
    // 4. Clean up local photos
    await photoStore.deletePhotos(photoIds);
  },

    async editCommentInViolation(violationId: string, commentId: string, newText: string): Promise<void> {
        const violationRef = doc(db, 'violations', violationId);
        await runTransaction(db, async (transaction) => {
            const violationDoc = await transaction.get(violationRef);
            if (!violationDoc.exists()) {
                throw new Error("Violation not found.");
            }
            const violation = violationDoc.data() as Violation;
            const comments = violation.comments || [];
            const commentIndex = comments.findIndex(c => c.id === commentId);

            if (commentIndex === -1) {
                throw new Error("Comment not found.");
            }
            
            const updatedComments = [...comments];
            updatedComments[commentIndex].text = newText;

            transaction.update(violationRef, { comments: updatedComments });
        });
    },

    async deleteCommentInViolation(violationId: string, commentId: string): Promise<void> {
        const violationRef = doc(db, 'violations', violationId);
        await runTransaction(db, async (transaction) => {
            const violationDoc = await transaction.get(violationRef);
            if (!violationDoc.exists()) throw "Report not found.";

            const existingViolation = violationDoc.data() as Violation;
            const existingComments: ViolationComment[] = existingViolation.comments || [];
            const commentToDelete = existingComments.find(c => c.id === commentId);
            
            if (commentToDelete?.photos) {
                await Promise.all(commentToDelete.photos.map(url => this.deletePhotoFromStorage(url)));
            }
            
            const updatedComments = existingComments.filter(c => c.id !== commentId);
            transaction.update(violationRef, { comments: updatedComments });
        });
    },
  
  async submitPenaltyProof(violationId: string, media: { id: string; type: 'photo' | 'video' }[], user: { userId: string; userName: string; }): Promise<void> {
    const uploadPromises = media.map(async (m) => {
        const blob = await photoStore.getPhoto(m.id);
        if (!blob) return null;
        const fileExtension = m.type === 'photo' ? 'jpg' : 'webm';
        const storageRef = ref(storage, `penalties/${violationId}/${user.userId}/${uuidv4()}.${fileExtension}`);        
        const metadata = {
            cacheControl: 'public,max-age=31536000,immutable',
        };
        await uploadBytes(storageRef, blob, metadata);
        const url = await getDownloadURL(storageRef);
        return { url, type: m.type };
    });
    
    const newMediaAttachments = (await Promise.all(uploadPromises)).filter((item): item is MediaAttachment => !!item);

    if (newMediaAttachments.length === 0) {
        throw new Error("Failed to upload penalty proof media.");
    }
    
    const violationRef = doc(db, 'violations', violationId);
    
    await runTransaction(db, async (transaction) => {
      const violationDoc = await transaction.get(violationRef);
      if (!violationDoc.exists()) {
        throw new Error("Violation not found.");
      }
      
      const violationData = violationDoc.data() as Violation;
      let submissions = violationData.penaltySubmissions || [];
      
      const existingSubmissionIndex = submissions.findIndex(s => s.userId === user.userId);
      
      if (existingSubmissionIndex > -1) {
        const existingSubmission = submissions[existingSubmissionIndex];
        const existingMedia = existingSubmission.media || (existingSubmission.photos || []).map(p => ({ url: p, type: 'photo' as const }));

        const updatedSubmission: PenaltySubmission = {
          ...existingSubmission,
          media: [...existingMedia, ...newMediaAttachments],
          submittedAt: new Date().toISOString(),
        };
        delete updatedSubmission.photos; // Remove the old field
        submissions[existingSubmissionIndex] = updatedSubmission;
      } else {
        const newSubmission: PenaltySubmission = {
          userId: user.userId,
          userName: user.userName,
          media: newMediaAttachments,
          submittedAt: new Date().toISOString(),
        };
        submissions.push(newSubmission);
      }

      transaction.update(violationRef, { penaltySubmissions: submissions });
    });

    await photoStore.deletePhotos(media.map(m => m.id));
  },

};