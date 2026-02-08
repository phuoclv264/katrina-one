'use client';

import type { BonusRecord, SalaryAdvanceRecord, CashHandoverReport, FinalHandoverDetails, MonthlySalarySheet, WhistleblowingReport, SimpleUser } from './types';
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
  WriteBatch,
  collectionGroup,
  runTransaction,
  or,
  and,
  arrayUnion,
  arrayRemove,
  documentId,
} from 'firebase/firestore';
import { DateRange } from 'react-day-picker';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'; // WhistleblowingReport is imported here
import type { ShiftReport, TasksByShift, CompletionRecord, TaskSection, InventoryItem, InventoryReport, ComprehensiveTaskSection, Suppliers, ManagedUser, Violation, AppSettings, ViolationCategory, DailySummary, Task, Schedule, AssignedShift, Notification, UserRole, AssignedUser, InventoryOrderSuggestion, ShiftTemplate, Availability, TimeSlot, ViolationComment, AuthUser, ExpenseSlip, IncidentReport, RevenueStats, ExpenseItem, ExpenseType, OtherCostCategory, UnitDefinition, IncidentCategory, PaymentMethod, Product, GlobalUnit, PassRequestPayload, IssueNote, ViolationCategoryData, FineRule, PenaltySubmission, ViolationUserCost, MediaAttachment, CashCount, ExtractHandoverDataOutput, AttendanceRecord, MonthlyTask, MonthlyTaskAssignment, JobApplication } from './types';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from './photo-store';
import { getISOWeek, getISOWeekYear, startOfMonth, endOfMonth, eachWeekOfInterval, getYear, format, eachDayOfInterval, startOfWeek, endOfWeek, getDay, addDays, parseISO, isPast, isWithinInterval, isSameMonth } from 'date-fns';
import { hasTimeConflict, getActiveShifts } from './schedule-utils';
import * as violationsService from './violations-service';
import isEqual from 'lodash.isequal';
import * as scheduleStore from './schedule-store';
import * as attendanceStore from './attendance-store';
import * as idbKeyvalStore from './idb-keyval-store';
import * as cashierStore from './cashier-store';
import * as dailyTaskStore from './daily-task-store';
import { deleteFileByUrl, uploadFile } from './data-store-helpers';
import { error } from 'console';
import { InventoryItemRow } from '@/app/(app)/bartender/inventory/_components/inventory-item-row';


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
// Make sure this runs only in the browser (avoid calling IndexedDB during SSR/module init).
if (typeof window !== 'undefined') {
  // Defer and swallow errors so boot is not blocked by cleanup.
  void photoStore.cleanupOldPhotos().catch((err) => console.error('Photo cleanup failed:', err));
}

const severityOrder: Record<ViolationCategory['severity'], number> = {
  low: 1,
  medium: 2,
  high: 3,
};


export const dataStore = {
  ...scheduleStore, // Spread all functions from schedule-store
  ...attendanceStore, // Spread all functions from attendance-store
  ...cashierStore, // Spread all functions from cashier-store
  ...dailyTaskStore,

  // --- Firebase Push Notifications ---
  async saveFcmToken(userId: string, token: string): Promise<void> {
    if (!userId || !token) return;
    const userRef = doc(db, 'users', userId);
    try {
      // Use arrayUnion to add the token only if it's not already there.
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
    } catch (error) {
      // If the document doesn't exist yet (e.g., race condition on signup), create it.
      console.error("Error saving FCM token, trying to set doc: ", error);
      try {
        await setDoc(userRef, { fcmTokens: [token] }, { merge: true });
      } catch (set_error) {
        console.error("Failed to set doc with FCM token: ", set_error);
      }
    }
  },

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    const fieldPath = `isRead.${userId}`;
    await updateDoc(docRef, {
      [fieldPath]: true
    });
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientUids', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(notificationsQuery);
    if (snapshot.empty) {
      return;
    }

    const batch = writeBatch(db);
    const fieldPath = `isRead.${userId}`;
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { [fieldPath]: true });
    });

    await batch.commit();
  },

  subscribeToAllRelevantNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    if (!userId) {
      callback([]);
      return () => { };
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientUids', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit to the last 50 relevant notifications for performance
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        resolvedAt: (doc.data().resolvedAt as Timestamp)?.toDate()?.toISOString(),
      } as Notification));
      callback(notifications);
    }, (error) => {
      console.error("Error subscribing to relevant notifications:", error);
      callback([]);
    });

    return unsubscribe;
  },

  // --- Monthly Tasks ---
  subscribeToMonthlyTasks(callback: (tasks: MonthlyTask[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'monthlyTasks');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback((docSnap.data().tasks || []) as MonthlyTask[]);
      } else {
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read monthly tasks: ${error.code}`);
      callback([]);
    });
  },

  async updateMonthlyTasks(tasks: MonthlyTask[]): Promise<void> {
    const docRef = doc(db, 'app-data', 'monthlyTasks');
    await setDoc(docRef, { tasks });
  },

  // --- Job Applications ---
  async submitJobApplication(application: Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<void> {
    const appRef = collection(db, 'jobApplications');
    const now = new Date().toISOString();
    await addDoc(appRef, {
      ...application,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  },

  subscribeToJobApplications(callback: (applications: JobApplication[]) => void): () => void {
    const q = query(collection(db, 'jobApplications'), orderBy('createdAt', 'desc'));

    // Try to open a real-time subscription first. Some browsers or environments
    // (older WebViews, restricted browsers) may fail to setup onSnapshot. In
    // that case fall back to a one-time getDocs() so the page still receives
    // application data.
    try {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const applications = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as JobApplication));
          callback(applications);
        },
        (error) => {
          // If onSnapshot emits an error, fall back to a single fetch.
          console.warn('[Firestore] onSnapshot error for jobApplications, falling back to getDocs():', error);
          getDocs(q)
            .then((snapshot) => {
              const applications = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as JobApplication));
              callback(applications);
            })
            .catch((err) => {
              console.error('Failed to fetch jobApplications via getDocs fallback:', err);
              callback([]);
            });
        }
      );

      return unsubscribe;
    } catch (e) {
      // Subscription setup threw synchronously (e.g., unsupported environment).
      // Perform one-time fetch to ensure the UI receives data and return a
      // no-op unsubscribe function.
      console.warn('[Firestore] Could not subscribe to jobApplications, performing one-time fetch:', e);
      getDocs(q)
        .then((snapshot) => {
          const applications = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as JobApplication));
          callback(applications);
        })
        .catch((err) => {
          console.error('Failed to fetch jobApplications via one-time getDocs:', err);
          callback([]);
        });

      return () => { /* no-op unsubscribe */ };
    }
  },

  async updateJobApplicationStatus(applicationId: string, status: JobApplication['status']): Promise<void> {
    const docRef = doc(db, 'jobApplications', applicationId);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  },

  async updateJobApplicationAdminNote(applicationId: string, adminNote: string): Promise<void> {
    const docRef = doc(db, 'jobApplications', applicationId);
    await updateDoc(docRef, {
      adminNote,
      updatedAt: new Date().toISOString()
    });
  },

  async deleteJobApplication(applicationId: string): Promise<void> {
    const docRef = doc(db, 'jobApplications', applicationId);
    await deleteDoc(docRef);
  },

  async bulkDeleteJobApplications(applicationIds: string[]): Promise<void> {
    const batch = writeBatch(db);
    applicationIds.forEach((id) => {
      const docRef = doc(db, 'jobApplications', id);
      batch.delete(docRef);
    });
    await batch.commit();
  },

  // --- Salary Management ---
  async getMonthlySalarySheet(monthId: string): Promise<MonthlySalarySheet | null> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as MonthlySalarySheet;
    }
    return null;
  },

  subscribeToUserAttendanceForDateRange(userId: string, dateRange: DateRange, callback: (records: AttendanceRecord[]) => void): () => void {
    if (!dateRange.from || !dateRange.to) {
      callback([]);
      return () => { };
    }
    const fromDate = dateRange.from;
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'attendance_records'),
      where('userId', '==', userId),
      where('checkInTime', '>=', fromDate),
      where('checkInTime', '<=', toDate),
      orderBy('checkInTime', 'desc')
    );

    return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord))));
  },

  subscribeToSchedulesForDateRange(
    dateRange: DateRange | undefined,
    callback: (schedules: Schedule[]) => void
  ): () => void {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      callback([]);
      return () => { }; // Return a no-op unsubscribe function
    }

    const fromDate = dateRange.from;
    const toDate = dateRange.to;

    // Adjust toDate to include the entire day
    toDate.setHours(23, 59, 59, 999);

    const weeks = eachWeekOfInterval({
      start: fromDate,
      end: toDate,
    }, { weekStartsOn: 1 });

    const weekIds = weeks.map(weekStart => `${getISOWeekYear(weekStart)}-W${getISOWeek(weekStart)}`);

    if (weekIds.length === 0) {
      callback([]);
      return () => { };
    }

    const q = query(collection(db, 'schedules'), where(documentId(), 'in', weekIds));
    return onSnapshot(q, (snapshot) => {
      const schedules = snapshot.docs.map(doc => ({ ...doc.data(), weekId: doc.id } as Schedule));
      callback(schedules);
    });
  },

  async saveMonthlySalarySheet(monthId: string, sheetData: Omit<MonthlySalarySheet, 'id'>): Promise<void> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    const existingDoc = await getDoc(docRef);

    if (existingDoc.exists()) {
      // If the document exists, we need to preserve the payment status.
      const existingSheet = existingDoc.data() as MonthlySalarySheet;
      const updatedRecords = { ...sheetData.salaryRecords };

      for (const userId in updatedRecords) {
        if (existingSheet.salaryRecords[userId]?.paymentStatus === 'paid') {
          updatedRecords[userId].paymentStatus = 'paid';
          updatedRecords[userId].paidAt = existingSheet.salaryRecords[userId].paidAt;
        } else {
          // Ensure paidAt is not undefined if status is not 'paid'
          delete updatedRecords[userId].paidAt;
        }
        // Preserve existing salary advance
        if (existingSheet.salaryRecords[userId]?.salaryAdvance) {
          updatedRecords[userId].salaryAdvance = existingSheet.salaryRecords[userId].salaryAdvance;
        }
        // Preserve existing advances list
        if (existingSheet.salaryRecords[userId]?.advances) {
          updatedRecords[userId].advances = existingSheet.salaryRecords[userId].advances;
        }
        // Preserve existing bonus
        if (existingSheet.salaryRecords[userId]?.bonus) {
          updatedRecords[userId].bonus = existingSheet.salaryRecords[userId].bonus;
        }
        if (existingSheet.salaryRecords[userId]?.actualPaidAmount) {
          updatedRecords[userId].actualPaidAmount = existingSheet.salaryRecords[userId].actualPaidAmount;
        }
      }
      await updateDoc(docRef, { ...sheetData, salaryRecords: updatedRecords });
    } else {
      // If it's a new document, just set it.
      const sanitizedRecords = { ...sheetData.salaryRecords } as typeof sheetData.salaryRecords;
      for (const userId in sanitizedRecords) {
        if (sanitizedRecords[userId].paidAt === undefined) {
          delete (sanitizedRecords[userId] as any).paidAt;
        }
      }
      await setDoc(docRef, { ...sheetData, salaryRecords: sanitizedRecords });
    }
  },

  async addSalaryAdvance(monthId: string, userId: string, amount: number, note: string, createdBy: SimpleUser): Promise<string> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    const advanceId = uuidv4();
    const newAdvance: SalaryAdvanceRecord = {
      id: advanceId,
      amount,
      note,
      createdBy,
      createdAt: new Date().toISOString()
    };

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
             throw new Error("Salary sheet not found");
        }
        const sheet = docSnap.data() as MonthlySalarySheet;
        const record = sheet.salaryRecords[userId];
        if (!record) {
             throw new Error("User record not found in salary sheet");
        }

        const currentAdvances = record.advances || [];
        const currentTotalAdvance = record.salaryAdvance || 0;

        const updatedAdvances = [...currentAdvances, newAdvance];
        const updatedTotalAdvance = currentTotalAdvance + amount;

        transaction.update(docRef, {
            [`salaryRecords.${userId}.advances`]: updatedAdvances,
            [`salaryRecords.${userId}.salaryAdvance`]: updatedTotalAdvance
        });
    });

    // Send notification
    try {
        const notification: Omit<Notification, 'id'> = {
            type: 'salary_update',
            createdAt: serverTimestamp() as Timestamp,
            recipientUids: [userId],
            messageTitle: 'Bạn nhận được khoản tạm ứng mới',
            messageBody: `Bạn đã được tạm ứng ${amount.toLocaleString('vi-VN')}đ. Lý do: ${note}`,
            payload: { monthId, advanceId },
            isRead: { [userId]: false }
        };
        await addDoc(collection(db, 'notifications'), notification);
    } catch (e) {
        console.error("Failed to send notification for advance", e);
    }

    // Create linked expense slip
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const recipientName = userDoc.exists() ? ((userDoc.data() as any).displayName || userId) : userId;
      // Set slip date to the first day of the current month (respecting getTodaysDateKey timezone)
      const todayKey = getTodaysDateKey();
      const [year, month] = todayKey.split('-');
      const dateStr = `${year}-${month}-01`;

      const slipData: Partial<ExpenseSlip> = {
        date: dateStr,
        expenseType: 'other_cost',
        items: [{
          itemId: 'other_cost',
          name: 'Tạm ứng lương',
          description: `Tạm ứng cho ${recipientName}. Lý do: ${note}. AdvanceId:${advanceId}`,
          supplier: recipientName,
          quantity: 1,
          unitPrice: amount,
          unit: 'cái'
        }],
        paymentMethod: 'cash',
        notes: `Tạm ứng lương cho ${recipientName}`,
        createdBy: { userId: createdBy.userId, userName: createdBy.userName },
        associatedSalaryAdvanceId: advanceId,
        associatedMonthId: monthId,
        associatedUserId: userId
      } as Partial<ExpenseSlip>;

      const slipId = await cashierStore.addOrUpdateExpenseSlip(slipData as any);

      // Link expense slip id back to the advance in the salary sheet in a new transaction
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error('Salary sheet not found when linking slip');
        const sheet = docSnap.data() as MonthlySalarySheet;
        const record = sheet.salaryRecords[userId];
        if (!record) throw new Error('User record not found when linking slip');

        const currentAdvances = record.advances || [];
        const updatedAdvances = currentAdvances.map(a => a.id === advanceId ? { ...a, expenseSlipId: slipId } : a);

        transaction.update(docRef, {
          [`salaryRecords.${userId}.advances`]: updatedAdvances
        });
      });
    } catch (slipErr) {
      console.error('Failed to create or link expense slip for salary advance:', slipErr);
    }

    return advanceId;
  },

  async deleteSalaryAdvance(monthId: string, userId: string, advanceId: string): Promise<void> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    let deletedAmount = 0;
    let deletedNote = '';

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
             throw new Error("Salary sheet not found");
        }
        const sheet = docSnap.data() as MonthlySalarySheet;
        const record = sheet.salaryRecords[userId];
        if (!record) {
             throw new Error("User record not found in salary sheet");
        }

        const currentAdvances = record.advances || [];
        const advanceToDelete = currentAdvances.find(a => a.id === advanceId);

        if (!advanceToDelete) {
            return;
        }
        deletedAmount = advanceToDelete.amount;
        deletedNote = advanceToDelete.note;

        const updatedAdvances = currentAdvances.filter(a => a.id !== advanceId);
        const updatedTotalAdvance = (record.salaryAdvance || 0) - advanceToDelete.amount;

        transaction.update(docRef, {
            [`salaryRecords.${userId}.advances`]: updatedAdvances,
            [`salaryRecords.${userId}.salaryAdvance`]: updatedTotalAdvance
        });
    });

    if (deletedAmount > 0) {
        // Send notification
        try {
            const notification: Omit<Notification, 'id'> = {
                type: 'salary_update',
                createdAt: serverTimestamp() as Timestamp,
                recipientUids: [userId],
                messageTitle: 'Hủy khoản tạm ứng',
                messageBody: `Khoản tạm ứng ${deletedAmount.toLocaleString('vi-VN')}đ đã bị hủy. Lý do hủy: ${deletedNote}`,
                payload: { monthId, advanceId },
                isRead: { [userId]: false }
            };
            await addDoc(collection(db, 'notifications'), notification);
        } catch (e) {
            console.error("Failed to send notification for advance deletion", e);
        }

        // Remove linked expense slip(s)
        try {
          const slipsQuery = query(collection(db, 'expense_slips'), where('associatedSalaryAdvanceId', '==', advanceId));
          const slipsSnapshot = await getDocs(slipsQuery);
          for (const slipDoc of slipsSnapshot.docs) {
            const slip = { id: slipDoc.id, ...slipDoc.data() } as ExpenseSlip;
            await cashierStore.deleteExpenseSlip(slip);
          }
        } catch (err) {
          console.error('Failed to remove linked expense slip for deleted advance:', err);
        }
    }
  },

  async updateSalaryBonus(monthId: string, userId: string, bonusAmount: number): Promise<void> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    await updateDoc(docRef, { [`salaryRecords.${userId}.bonus`]: bonusAmount });
  },

  async addSalaryBonus(monthId: string, userId: string, amount: number, note: string, createdBy: SimpleUser): Promise<string> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    const bonusId = uuidv4();
    const newBonus: BonusRecord = {
      id: bonusId,
      amount,
      note,
      createdBy,
      createdAt: new Date().toISOString()
    };

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
             throw new Error("Salary sheet not found");
        }
        const sheet = docSnap.data() as MonthlySalarySheet;
        const record = sheet.salaryRecords[userId];
        if (!record) {
             throw new Error("User record not found in salary sheet");
        }

        const currentBonuses = record.bonuses || [];
        const currentTotalBonus = record.bonus || 0;

        const updatedBonuses = [...currentBonuses, newBonus];
        const updatedTotalBonus = currentTotalBonus + amount;

        transaction.update(docRef, {
            [`salaryRecords.${userId}.bonuses`]: updatedBonuses,
            [`salaryRecords.${userId}.bonus`]: updatedTotalBonus
        });
    });

    // Send notification
    try {
        const notification: Omit<Notification, 'id'> = {
            type: 'salary_update',
            createdAt: serverTimestamp() as Timestamp,
            recipientUids: [userId],
            messageTitle: 'Bạn nhận được tiền thưởng mới',
            messageBody: `Bạn đã được thưởng ${amount.toLocaleString('vi-VN')}đ. Lý do: ${note}`,
            payload: { monthId, bonusId },
            isRead: { [userId]: false }
        };
        await addDoc(collection(db, 'notifications'), notification);
    } catch (e) {
        console.error("Failed to send notification for bonus", e);
    }
    
    return bonusId;
  },

  async deleteSalaryBonus(monthId: string, userId: string, bonusId: string): Promise<void> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    let deletedAmount = 0;
    let deletedNote = '';

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
             throw new Error("Salary sheet not found");
        }
        const sheet = docSnap.data() as MonthlySalarySheet;
        const record = sheet.salaryRecords[userId];
        if (!record) {
             throw new Error("User record not found in salary sheet");
        }

        const currentBonuses = record.bonuses || [];
        const bonusToDelete = currentBonuses.find(b => b.id === bonusId);

        if (!bonusToDelete) {
            return;
        }
        deletedAmount = bonusToDelete.amount;
        deletedNote = bonusToDelete.note;

        const updatedBonuses = currentBonuses.filter(b => b.id !== bonusId);
        const updatedTotalBonus = (record.bonus || 0) - bonusToDelete.amount;

        transaction.update(docRef, {
            [`salaryRecords.${userId}.bonuses`]: updatedBonuses,
            [`salaryRecords.${userId}.bonus`]: updatedTotalBonus
        });
    });

    if (deletedAmount > 0) {
        // Send notification
        try {
            const notification: Omit<Notification, 'id'> = {
                type: 'salary_update',
                createdAt: serverTimestamp() as Timestamp,
                recipientUids: [userId],
                messageTitle: 'Điều chỉnh tiền thưởng',
                messageBody: `Khoản thưởng ${deletedAmount.toLocaleString('vi-VN')}đ đã bị hủy. Lý do hủy: ${deletedNote}`,
                payload: { monthId, bonusId },
                isRead: { [userId]: false }
            };
            await addDoc(collection(db, 'notifications'), notification);
        } catch (e) {
            console.error("Failed to send notification for bonus deletion", e);
        }
    }
  },

  /**
   * Unified method to update payment-related fields for a salary record.
   * You can update the payment status and/or the actual paid amount in a single call.
   */
  async updateSalaryPayment(
    monthId: string,
    userId: string,
    status?: 'paid' | 'unpaid',
    actualPaidAmount?: number
  ): Promise<void> {
    const docRef = doc(db, 'monthly_salaries', monthId);
    const updateData: any = {};

    if (typeof status !== 'undefined') {
      updateData[`salaryRecords.${userId}.paymentStatus`] = status;
      if (status === 'paid') {
        updateData[`salaryRecords.${userId}.paidAt`] = serverTimestamp();
      }
    }

    if (typeof actualPaidAmount !== 'undefined') {
      updateData[`salaryRecords.${userId}.actualPaidAmount`] = actualPaidAmount;
    }

    if (Object.keys(updateData).length === 0) return;

    await updateDoc(docRef, updateData);
  },

  async getAllViolationRecords(): Promise<Violation[]> {
    const q = query(collection(db, 'violations'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Violation));
  },
  // --- Global Units ---
  subscribeToGlobalUnits(callback: (units: GlobalUnit[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'unitDefinitions');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().units as GlobalUnit[]);
      } else {
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read global units: ${error.code}`);
      callback([]);
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
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read products: ${error.code}`);
      callback([]);
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
        callback({ isRegistrationEnabled: false });
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
    // Remove undefined fields to avoid Firestore errors (updateDoc does not accept undefined)
    const payload: any = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) payload[k] = v;
    });
    if (Object.keys(payload).length === 0) return; // nothing to update
    await updateDoc(userRef, payload);
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
      if (reportData.stockLevels) {
        for (const itemId in reportData.stockLevels) {
          const record = reportData.stockLevels[itemId];
          if (record.photos) {
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
        callback({} as TasksByShift);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read server tasks: ${error.code} - ${error.message}}`);
      callback({} as TasksByShift);
    });
    return unsubscribe;
  },

  async updateTasks(newTasks: TasksByShift) {
    const docRef = doc(db, 'app-data', 'tasks');
    // Firestore rejects undefined values anywhere in the document. Remove undefined fields recursively.
    const removeUndefined = (obj: any): any => {
      if (obj === undefined) return undefined;
      if (obj === null) return null;
      if (Array.isArray(obj)) return obj.map(removeUndefined).filter(v => v !== undefined);
      if (typeof obj === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(obj)) {
          const cleaned = removeUndefined(v);
          if (cleaned !== undefined) out[k] = cleaned;
        }
        return out;
      }
      return obj;
    };

    const sanitized = removeUndefined(newTasks);
    await setDoc(docRef, sanitized);
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
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read bartender tasks: ${error.code}`);
      callback([]);
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
        callback([]);
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
    return [] as InventoryItem[];
  },

  subscribeToInventoryList(callback: (items: InventoryItem[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'inventoryList');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        let items = (docSnap.data().items || []) as InventoryItem[];

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
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read inventory list: ${error.code}`);
      callback([]);
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
      if (docSnap.exists()) {
        callback(docSnap.data().list as string[]);
      } else {
        callback([]);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read suppliers list: ${error.code}`);
      callback([]);
    });
    return unsubscribe;
  },

  async getSuppliers(): Promise<string[]> {
    const docRef = doc(db, 'app-data', 'suppliers');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().list as string[];
    }
    return [] as string[];
  },

  async updateSuppliers(newSuppliers: string[]) {
    const docRef = doc(db, 'app-data', 'suppliers');
    await setDoc(docRef, { list: newSuppliers });
  },

  createEmptyInventoryReport(userId: string, staffName: string): InventoryReport {
    if (typeof window === 'undefined') {
      throw new Error("Cannot create report from server-side.");
    }
    const date = getTodaysDateKey();
    const reportId = `inventory-report-${userId}-${date}`;

    return {
      id: reportId,
      userId,
      staffName,
      date,
      status: 'ongoing',
      stockLevels: {},
      suggestions: null,
      lastUpdated: new Date().toISOString(),
    };
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

  async getOrCreateReport(userId: string, staffName: string, shiftKey: string): Promise<{ report: ShiftReport, status: 'synced' | 'local-newer' | 'server-newer' | 'error' }> {
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

      if (localReport && !serverDoc.exists()) {
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


    } catch (error) {
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
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
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
      console.error(`[Firestore Read Error] Could not read reports for shift ${shiftKey}: ${error.code} - ${error.message}`);
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
        const { cost: newCost, severity: newSeverity, userCosts: newUserCosts } = violationsService.calculateViolationCost(violation, cachedCategories!, violationsInMonth);
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

  subscribeToViolationsForMonth(targetMonth: Date, callback: (violations: Violation[]) => void): () => void {
    const start = startOfMonth(targetMonth);
    const end = endOfMonth(targetMonth);
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const violationsQuery = query(collection(db, 'violations'), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs), orderBy('createdAt', 'desc'));
    const categoriesDocRef = doc(db, 'app-data', 'violationCategories');

    let cachedCategories: ViolationCategoryData | null = null;
    let cachedViolations: Violation[] = [];

    const processAndCallback = async () => {
      if (!cachedCategories) {
        // If categories not yet loaded, return current cachedViolations (may be empty)
        callback(cachedViolations);
        return;
      }

      // cachedViolations already contains only violations in the requested month (query-scoped)
      const updatedViolationsMap = new Map(cachedViolations.map(v => [v.id, v]));
      const batch = writeBatch(db);
      let hasUpdates = false;

      for (const violation of cachedViolations) {
        const { cost: newCost, severity: newSeverity, userCosts: newUserCosts } = violationsService.calculateViolationCost(violation, cachedCategories!, cachedViolations);
        const currentViolationState = updatedViolationsMap.get(violation.id)!;
        if (currentViolationState.cost !== newCost || currentViolationState.severity !== newSeverity || !isEqual(currentViolationState.userCosts, newUserCosts)) {
          const docRef = doc(db, 'violations', violation.id);
          batch.update(docRef, { cost: newCost, severity: newSeverity, userCosts: newUserCosts });
          updatedViolationsMap.set(violation.id, { ...currentViolationState, cost: newCost, severity: newSeverity, userCosts: newUserCosts });
          hasUpdates = true;
        }
      }

      const finalViolationList = Array.from(updatedViolationsMap.values());
      if (hasUpdates) {
        callback(finalViolationList);
        try {
          await batch.commit();
        } catch (err) {
          console.error("Error batch updating violation costs (monthly):", err);
        }
      } else {
        callback(finalViolationList);
      }
    };

    const unsubCategories = onSnapshot(categoriesDocRef, (docSnap) => {
      if (docSnap.exists()) {
        cachedCategories = docSnap.data() as ViolationCategoryData;
        processAndCallback();
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read violation categories: ${error.code}`);
      callback([]);
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
      processAndCallback();
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read monthly violations: ${error.code}`);
      callback([]);
    });

    return () => {
      unsubCategories();
      unsubViolations();
    };
  },

  async recalculateViolationsForCurrentMonth(): Promise<void> {
    return violationsService.recalculateViolationsForCurrentMonth();
  },

  subscribeToViolationCategories(callback: (data: ViolationCategoryData) => void): () => void {
    const docRef = doc(db, 'app-data', 'violationCategories');
    const defaultData: ViolationCategoryData = {
      list: [] as ViolationCategory[],
      generalRules: [] as FineRule[],
      generalNote: '',
    };
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          list: (data.list || defaultData.list) as ViolationCategory[],
          generalRules: (data.generalRules || []) as FineRule[],
        });
      } else {
        callback({
          list: defaultData.list,
          generalRules: defaultData.generalRules,
        } as ViolationCategoryData);
      }
    }, (error) => {
      console.warn(`[Firestore Read Error] Could not read violation categories: ${error.code}`);
      callback({} as ViolationCategoryData);
    });
    return unsubscribe;
  },

  async getViolationCategories(): Promise<ViolationCategoryData> {
    const docRef = doc(db, 'app-data', 'violationCategories');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        list: (data.list || []) as ViolationCategory[],
        generalRules: (data.generalRules || []) as FineRule[],
      };
    }
    return { list: [] as ViolationCategory[], generalRules: [] };
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
    return violationsService.calculateViolationCost(violation, categoryData, allHistoricViolationsInMonth);
  },

  async addOrUpdateViolation(
    data: Omit<Violation, 'id' | 'createdAt' | 'photos' | 'penaltySubmissions' | 'cost' | 'severity'> & { photosToUpload: string[] },
    id?: string
  ): Promise<void> {
    return violationsService.addOrUpdateViolation(data as any, id);
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

    // Clean up any pending penalty records for this violation
    try {
      const keys = await idbKeyvalStore.keys();
      const pendingKeys = keys.filter(k => typeof k === 'string' && (k as string).startsWith('pending-penalty-')) as string[];
      for (const key of pendingKeys) {
        const record = await idbKeyvalStore.get<any>(key);
        if (!record) continue;
        const isBulk = record.isBulk === true;
        const violationIds = isBulk ? record.violationIds : [record.violationId];
        if (violationIds.includes(violation.id)) {
          await idbKeyvalStore.del(key);
          // Also clean up any photos if they exist
          if (record.mediaIds && record.mediaIds.length > 0) {
            await photoStore.deletePhotos(record.mediaIds);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to clean up pending penalty records for deleted violation:', err);
    }
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
    // Durable submit: create a pending entry in IndexedDB so we can retry commit
    const pendingId = uuidv4();
    const pendingKey = `pending-penalty-${pendingId}`;

    const pendingRecord: any = {
      id: pendingId,
      violationId,
      user,
      mediaIds: [] as string[], // Will be populated with only found media IDs
      createdAt: new Date().toISOString(),
      status: 'pending', // pending -> uploading -> uploaded -> committing -> done | failed
      uploaded: [] as MediaAttachment[],
    };

    // Persist the pending record so it survives reloads
    await idbKeyvalStore.set(pendingKey, pendingRecord);

    try {
      // Upload each media and update the pending record incrementally
      for (const m of media) {
        const blob = await photoStore.getPhoto(m.id);
        if (!blob) {
          console.warn(`Media ${m.id} not found in store during initial upload`);
          continue; // skip missing
        }

        // Only add to mediaIds if the photo exists
        pendingRecord.mediaIds.push(m.id);

        const fileExtension = m.type === 'photo' ? 'jpg' : 'webm';
        const storageRef = ref(storage, `penalties/${violationId}/${user.userId}/${uuidv4()}.${fileExtension}`);
        const metadata = { cacheControl: 'public,max-age=31536000,immutable' };
        await uploadBytes(storageRef, blob, metadata);
        const url = await getDownloadURL(storageRef);

        const attachment: MediaAttachment = { url, type: m.type } as MediaAttachment;
        pendingRecord.uploaded.push(attachment);
        pendingRecord.status = 'uploading';
        await idbKeyvalStore.set(pendingKey, pendingRecord);
      }

      if (!pendingRecord.uploaded || pendingRecord.uploaded.length === 0) {
        throw new Error('Failed to upload penalty proof media.');
      }

      pendingRecord.status = 'uploaded';
      await idbKeyvalStore.set(pendingKey, pendingRecord);

      // Attempt Firestore transaction to append submission
      const violationRef = doc(db, 'violations', violationId);
      pendingRecord.status = 'committing';
      await idbKeyvalStore.set(pendingKey, pendingRecord);

      await runTransaction(db, async (transaction) => {
        const violationDoc = await transaction.get(violationRef);
        if (!violationDoc.exists()) {
          throw new Error('Violation not found.');
        }

        const violationData = violationDoc.data() as Violation;
        let submissions = violationData.penaltySubmissions || [];

        const existingSubmissionIndex = submissions.findIndex(s => s.userId === user.userId);

        if (existingSubmissionIndex > -1) {
          const existingSubmission = submissions[existingSubmissionIndex];
          const existingMedia = existingSubmission.media || (existingSubmission.photos || []).map((p: string) => ({ url: p, type: 'photo' as const }));
          const updatedSubmission: PenaltySubmission = {
            ...existingSubmission,
            media: [...existingMedia, ...pendingRecord.uploaded],
            submittedAt: new Date().toISOString(),
          };
          delete (updatedSubmission as any).photos;
          submissions[existingSubmissionIndex] = updatedSubmission;
        } else {
          const newSubmission: PenaltySubmission = {
            userId: user.userId,
            userName: user.userName,
            media: pendingRecord.uploaded,
            submittedAt: new Date().toISOString(),
          };
          submissions.push(newSubmission);
        }

        transaction.update(violationRef, { penaltySubmissions: submissions });
      });

      // On success, delete the pending record and remove local copies
      await idbKeyvalStore.del(pendingKey);
      await photoStore.deletePhotos(pendingRecord.mediaIds);
    } catch (err) {
      // Leave the pending record in IndexedDB with status 'failed' so UI or background retry can pick it up
      try {
        pendingRecord.status = pendingRecord.status === 'committing' ? 'commit_failed' : 'failed';
        pendingRecord.error = (err as any)?.message || String(err);
        await idbKeyvalStore.set(pendingKey, pendingRecord);
      } catch (innerErr) {
        console.error('Failed to update pending penalty record after error:', innerErr);
      }
      throw err;
    }
  },

  // Retry any pending penalty submissions stored in IndexedDB. Call this on app start or when network resumes.
  async retryPendingPenaltySubmissions(): Promise<void> {
    try {
      const keys = await idbKeyvalStore.keys();
      const pendingKeys = keys.filter(k => typeof k === 'string' && (k as string).startsWith('pending-penalty-')) as string[];

      for (const key of pendingKeys) {
        const record = await idbKeyvalStore.get<any>(key);
        if (!record) {
          console.warn(`[retryPendingPenaltySubmissions] No record found for key: ${key}`);
          continue;
        }

        if (record.status === 'done') {
          await idbKeyvalStore.del(key);
          continue;
        }

        const isBulk = record.isBulk === true;
        const violationIds = isBulk ? record.violationIds : [record.violationId];

        // Clean up records with no media (corrupted/incomplete records)
        if (!record.mediaIds || record.mediaIds.length === 0) {
          console.warn(`[retryPendingPenaltySubmissions] No media IDs in record, cleaning up: ${key}`, record);
          await idbKeyvalStore.del(key);
          continue;
        }

        // Check if violations still exist before proceeding
        let allViolationsExist = true;
        for (const violationId of violationIds) {
          const violationRef = doc(db, 'violations', violationId);
          const violationDoc = await getDoc(violationRef);
          if (!violationDoc.exists()) {
            console.warn(`[retryPendingPenaltySubmissions] Violation ${violationId} was deleted, cleaning up pending record: ${key}`);
            allViolationsExist = false;
            break;
          }
        }

        if (!allViolationsExist) {
          // Clean up the pending record and photos since violation(s) no longer exist
          await idbKeyvalStore.del(key);
          if (record.mediaIds && record.mediaIds.length > 0) {
            await photoStore.deletePhotos(record.mediaIds);
          }
          continue;
        }

        // If NOT fully uploaded yet, attempt to upload any remaining media
        if (record.status !== 'uploaded' && record.status !== 'committing' && record.status !== 'done') {
          try {
            // Determine which media IDs still need to be uploaded
            const uploadedCount = (record.uploaded || []).length;
            const totalMediaCount = record.mediaIds.length;

            // Re-attempt uploading remaining media starting from where we left off
            for (let i = uploadedCount; i < totalMediaCount; i++) {
              const mediaId = record.mediaIds[i];
              const blob = await photoStore.getPhoto(mediaId);
              if (!blob) {
                console.warn(`[retryPendingPenaltySubmissions] Photo ${mediaId} not found in store during retry`);
                continue;
              }

              const fileExtension = mediaId.includes('video') || mediaId.includes('.webm') ? 'webm' : 'jpg';
              const storagePath = isBulk
                ? `penalties/bulk-${record.user.userId}/${uuidv4()}.${fileExtension}`
                : `penalties/${violationIds[0]}/${record.user.userId}/${uuidv4()}.${fileExtension}`;
              const storageRef = ref(storage, storagePath);
              const metadata = { cacheControl: 'public,max-age=31536000,immutable' };
              await uploadBytes(storageRef, blob, metadata);
              const url = await getDownloadURL(storageRef);

              const attachment: MediaAttachment = { url, type: fileExtension === 'webm' ? 'video' : 'photo' } as MediaAttachment;
              record.uploaded.push(attachment);
              record.status = 'uploading';
              await idbKeyvalStore.set(key, record);
            }

            if (record.uploaded && record.uploaded.length > 0) {
              record.status = 'uploaded';
              await idbKeyvalStore.set(key, record);
            }
          } catch (uploadErr) {
            // Leave for next retry attempt
            record.status = 'failed';
            record.error = (uploadErr as any)?.message || String(uploadErr);
            await idbKeyvalStore.set(key, record);
            continue;
          }
        }

        // If uploaded but not committed, attempt the transaction commit
        // Handle: 'uploaded', 'committing', 'commit_failed', and 'pending' (if uploads are done)
        if (record.uploaded && record.uploaded.length > 0 &&
          (record.status === 'uploaded' || record.status === 'committing' || record.status === 'commit_failed' || record.status === 'pending')) {
          try {
            // Handle both single and bulk submissions
            for (const violationId of violationIds) {
              const violationRef = doc(db, 'violations', violationId);
              await runTransaction(db, async (transaction) => {
                const violationDoc = await transaction.get(violationRef);
                if (!violationDoc.exists()) {
                  console.warn(`[retryPendingPenaltySubmissions] Violation ${violationId} not found during retry`);
                  return;
                }
                const violationData = violationDoc.data() as Violation;
                let submissions = violationData.penaltySubmissions || [];
                const existingIndex = submissions.findIndex((s: any) => s.userId === record.user.userId);
                if (existingIndex > -1) {
                  const existing = submissions[existingIndex];
                  const existingMedia = existing.media || (existing.photos || []).map((p: string) => ({ url: p, type: 'photo' as const }));
                  submissions[existingIndex] = { ...existing, media: [...existingMedia, ...record.uploaded], submittedAt: new Date().toISOString() };
                } else {
                  submissions.push({ userId: record.user.userId, userName: record.user.userName, media: record.uploaded, submittedAt: new Date().toISOString() });
                }
                transaction.update(violationRef, { penaltySubmissions: submissions });
              });
            }
            // success
            await idbKeyvalStore.del(key);
            // Optionally delete local photos
            if (record.mediaIds && record.mediaIds.length > 0) {
              await photoStore.deletePhotos(record.mediaIds);
            }
          } catch (txErr) {
            console.error('[retryPendingPenaltySubmissions] Retry commit failed for pending penalty record', key, txErr);
            // leave for next retry
          }
        }
      }
    } catch (err) {
      console.error('[retryPendingPenaltySubmissions] Failed to retry pending penalty submissions:', err);
    }
  },

  async submitBulkPenaltyProof(violationIds: string[], media: { id: string; type: 'photo' | 'video' }[], user: { userId: string; userName: string; }): Promise<void> {
    // For bulk submissions, upload media once and reuse URLs for all violations
    // Use durable pending record for retry capability
    const pendingId = uuidv4();
    const pendingKey = `pending-penalty-${pendingId}`;

    const pendingRecord: any = {
      id: pendingId,
      violationIds, // Array for bulk submissions
      user,
      mediaIds: [] as string[], // Will be populated with only found media IDs
      createdAt: new Date().toISOString(),
      status: 'pending', // pending -> uploading -> uploaded -> committing -> done | failed
      uploaded: [] as MediaAttachment[],
      isBulk: true, // Flag to identify bulk submissions
    };

    // Persist the pending record so it survives reloads
    await idbKeyvalStore.set(pendingKey, pendingRecord);

    try {
      // Step 1: Upload all media once (shared for all violations)
      for (const m of media) {
        const blob = await photoStore.getPhoto(m.id);
        if (!blob) {
          console.warn(`Media ${m.id} not found in store during initial upload`);
          continue;
        }

        // Only add to mediaIds if the photo exists
        pendingRecord.mediaIds.push(m.id);

        const fileExtension = m.type === 'photo' ? 'jpg' : 'webm';
        const storageRef = ref(storage, `penalties/bulk-${user.userId}/${uuidv4()}.${fileExtension}`);
        const metadata = { cacheControl: 'public,max-age=31536000,immutable' };
        await uploadBytes(storageRef, blob, metadata);
        const url = await getDownloadURL(storageRef);

        const attachment: MediaAttachment = { url, type: m.type } as MediaAttachment;
        pendingRecord.uploaded.push(attachment);
        pendingRecord.status = 'uploading';
        await idbKeyvalStore.set(pendingKey, pendingRecord);
      }

      if (pendingRecord.uploaded.length === 0) {
        throw new Error('Failed to upload penalty proof media.');
      }

      pendingRecord.status = 'uploaded';
      await idbKeyvalStore.set(pendingKey, pendingRecord);

      // Step 2: Submit to all violations with the same uploaded media
      pendingRecord.status = 'committing';
      await idbKeyvalStore.set(pendingKey, pendingRecord);

      for (const violationId of violationIds) {
        const violationRef = doc(db, 'violations', violationId);

        await runTransaction(db, async (transaction) => {
          const violationDoc = await transaction.get(violationRef);
          if (!violationDoc.exists()) {
            console.warn(`Violation ${violationId} not found`);
            return;
          }

          const violationData = violationDoc.data() as Violation;
          const currentSubmissions = violationData.penaltySubmissions || [];

          const newSubmission: PenaltySubmission = {
            userId: user.userId,
            userName: user.userName,
            media: pendingRecord.uploaded,
            submittedAt: new Date().toISOString(),
          };
          currentSubmissions.push(newSubmission);

          transaction.update(violationRef, { penaltySubmissions: currentSubmissions });
        });
      }

      // Step 3: Only delete photos after all violations have been updated
      await photoStore.deletePhotos(pendingRecord.mediaIds);
      await idbKeyvalStore.del(pendingKey);
    } catch (err) {
      // Leave the pending record in IndexedDB with status 'failed' so UI or background retry can pick it up
      try {
        pendingRecord.status = pendingRecord.status === 'committing' ? 'commit_failed' : 'failed';
        pendingRecord.error = (err as any)?.message || String(err);
        await idbKeyvalStore.set(pendingKey, pendingRecord);
      } catch (innerErr) {
        console.error('Failed to update pending penalty record after error:', innerErr);
      }
      throw err;
    }
  },

  // Owner can mark a violation penalty as submitted without media (manual confirmation)
  async markPenaltyAsSubmitted(violationId: string, byUser: { userId: string; userName: string; }, note?: string): Promise<void> {
    const violationRef = doc(db, 'violations', violationId);
    await runTransaction(db, async (transaction) => {
      const violationDoc = await transaction.get(violationRef);
      if (!violationDoc.exists()) throw new Error('Violation not found');
      const violationData = violationDoc.data() as Violation;
      const submissions = violationData.penaltySubmissions || [];
      submissions.push({ userId: byUser.userId, userName: byUser.userName, media: [], submittedAt: new Date().toISOString() });
      transaction.update(violationRef, { penaltySubmissions: submissions });
    });
  },

  subscribeToReportsForDay(date: string, callback: (reports: ShiftReport[]) => void): () => void {
    const reportsCollection = collection(db, 'reports');
    const q = query(
      reportsCollection,
      where('date', '==', date),
      where('status', '==', 'submitted'),
      orderBy('submittedAt', 'desc')
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
      console.error(`[Firestore Read Error] Could not read reports for day ${date}: ${error.code} - ${error.message}`);
      callback([]);
    });
  },

  async getShiftReportsForDateRange({ from, to }: { from: Date, to: Date }): Promise<ShiftReport[]> {
    const q = query(collection(db, 'reports'), where('status', '==', 'submitted'), where('submittedAt', '>=', from), where('submittedAt', '<=', to));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        submittedAt: (data.submittedAt as Timestamp)?.toDate().toISOString() || data.submittedAt,
      } as ShiftReport;
    });
  },
  async getViolationsForDateRange({ from, to }: { from: Date, to: Date }): Promise<Violation[]> {
    const q = query(collection(db, 'violations'), where('createdAt', '>=', from), where('createdAt', '<=', to));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() } as Violation));
  },

  subscribeToReportFeed(callback: (reports: WhistleblowingReport[]) => void): () => void {
    const q = query(collection(db, 'reports-feed'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhistleblowingReport));
      callback(reports);
    });
  },
};
