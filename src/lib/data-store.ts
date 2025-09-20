

'use client';

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
  deleteDoc,
  limit,
  writeBatch,
  runTransaction,
  or,
  arrayUnion,
  arrayRemove,
  and,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { ShiftReport, TasksByShift, CompletionRecord, TaskSection, InventoryItem, InventoryReport, ComprehensiveTask, ComprehensiveTaskSection, AppError, Suppliers, ManagedUser, Violation, AppSettings, ViolationCategory, DailySummary, Task, Schedule, AssignedShift, Notification, UserRole, AssignedUser, InventoryOrderSuggestion, ShiftTemplate, Availability, TimeSlot, ViolationComment, AuthUser, ExpenseSlip, IncidentReport, RevenueStats, ExpenseItem, PriceHistoryEntry, StockHistoryEntry } from './types';
import { tasksByShift as initialTasksByShift, bartenderTasks as initialBartenderTasks, inventoryList as initialInventoryList, suppliers as initialSuppliers, initialViolationCategories, defaultTimeSlots } from './data';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from './photo-store';
import { getISOWeek, startOfMonth, endOfMonth, eachWeekOfInterval, getYear, format, eachDayOfInterval, startOfWeek, endOfWeek, getDay, addDays, parseISO, isPast } from 'date-fns';
import { hasTimeConflict } from './schedule-utils';


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


// Also clean up old photos from IndexedDB
// This will run when the app first loads the dataStore file.
photoStore.cleanupOldPhotos();


export const dataStore = {
     // --- Cashier ---

    async addIncidentReport(data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'>, user: AuthUser): Promise<void> {
        const incidentData = {
            ...data,
            date: format(new Date(), 'yyyy-MM-dd'),
            createdBy: { userId: user.uid, userName: user.displayName || 'N/A' },
            createdAt: serverTimestamp(),
        };

        const incidentCollection = collection(db, 'incidents');
        await addDoc(incidentCollection, incidentData);

        // If there's a cost, create a corresponding expense slip
        if (data.cost > 0) {
            const expenseSlipData: Partial<ExpenseSlip> = {
                date: format(new Date(), 'yyyy-MM-dd'),
                items: [{
                    itemId: 'incident_cost',
                    name: `Chi phí sự cố: ${data.content}`,
                    supplier: 'N/A',
                    quantity: 1,
                    unitPrice: data.cost,
                    unit: 'lần',
                }],
                totalAmount: data.cost,
                paymentMethod: 'cash',
                notes: `Tự động tạo từ báo cáo sự cố.`,
                createdBy: { userId: user.uid, userName: user.displayName || 'N/A' },
            };
            await this.addOrUpdateExpenseSlip(expenseSlipData);
        }
    },

    subscribeToRevenueStats(date: string, callback: (stats: RevenueStats | null) => void): () => void {
        const docRef = doc(db, 'revenue_stats', date);
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                 const data = docSnap.data();
                 callback({
                     id: docSnap.id,
                     ...data,
                     createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                 } as RevenueStats);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error(`[Firestore Read Error] Could not read revenue stats: ${error.code}`);
            callback(null);
        });
    },

    async getRevenueStats(date: string): Promise<RevenueStats | null> {
        const docRef = doc(db, 'revenue_stats', date);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
             const data = docSnap.data();
             return {
                 id: docSnap.id,
                 ...data,
                 createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
             } as RevenueStats;
        }
        return null;
    },

    async addOrUpdateRevenueStats(data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, user: AuthUser, isEdited: boolean): Promise<void> {
        const date = format(new Date(), 'yyyy-MM-dd');
        const docRef = doc(db, 'revenue_stats', date);

        let finalData: Partial<RevenueStats> = {
            ...data,
            date,
            createdBy: { userId: user.uid, userName: user.displayName || 'N/A' },
            createdAt: serverTimestamp(),
            isEdited: isEdited,
        };

        if (data.invoiceImageUrl && data.invoiceImageUrl.startsWith('data:')) {
            const blob = await (await fetch(data.invoiceImageUrl)).blob();
            const storageRef = ref(storage, `revenue-invoices/${date}/${uuidv4()}.jpg`);
            await uploadBytes(storageRef, blob);
            finalData.invoiceImageUrl = await getDownloadURL(storageRef);
        } else {
            // if image is not new, don't update it unless it's explicitly passed as null/undefined to be cleared
            if (data.invoiceImageUrl === undefined) {
                 delete finalData.invoiceImageUrl;
            }
        }
    
        // If there's a delivery partner payout, also create an expense slip
        if (data.deliveryPartnerPayout > 0) {
            const expenseData: Partial<ExpenseSlip> = {
                date,
                items: [{
                    itemId: 'delivery_payout',
                    name: 'Chi trả cho Đối tác Giao hàng',
                    supplier: 'N/A',
                    quantity: 1,
                    unitPrice: data.deliveryPartnerPayout,
                    unit: 'lần',
                }],
                totalAmount: data.deliveryPartnerPayout,
                paymentMethod: 'cash',
                notes: 'Tự động tạo từ thống kê doanh thu.',
                createdBy: { userId: user.uid, userName: user.displayName || 'N/A' },
            };
            this.addOrUpdateExpenseSlip(expenseData).catch(e => console.error("Failed to auto-create expense slip for delivery payout:", e));
        }

        await setDoc(docRef, finalData, { merge: true });
    },


    subscribeToDailyExpenseSlips(date: string, callback: (slips: ExpenseSlip[]) => void): () => void {
        const slipsCollection = collection(db, 'expense_slips');
        const q = query(slipsCollection, where('date', '==', date), orderBy('createdAt', 'desc'));
        
        return onSnapshot(q, (snapshot) => {
            const slips = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as ExpenseSlip));
            callback(slips);
        }, (error) => {
            console.error(`[Firestore Read Error] Could not read daily expense slips: ${error.code}`);
            callback([]);
        });
    },

    async getDailyExpenseSlips(date: string): Promise<ExpenseSlip[]> {
         const slipsCollection = collection(db, 'expense_slips');
        const q = query(slipsCollection, where('date', '==', date), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ExpenseSlip));
    },

    async addOrUpdateExpenseSlip(data: any, id?: string): Promise<void> {
        const docRef = id ? doc(db, 'expense_slips', id) : doc(collection(db, 'expense_slips'));
        const { existingPhotos, photosToDelete, newPhotoIds, ...slipData } = data;
    
        await runTransaction(db, async (transaction) => {
            const inventoryDocRef = doc(db, 'app-data', 'inventoryList');
            const inventorySnap = await transaction.get(inventoryDocRef);
            if (!inventorySnap.exists()) {
                throw new Error("Không tìm thấy danh sách hàng tồn kho.");
            }
            const inventoryList = (inventorySnap.data() as { items: InventoryItem[] }).items;
    
            // If editing, find the old slip to revert changes before applying new ones.
            if (id) {
                const oldSlipSnap = await transaction.get(docRef);
                if (oldSlipSnap.exists()) {
                    const oldSlip = oldSlipSnap.data() as ExpenseSlip;
                    oldSlip.items.forEach(oldItem => {
                        const itemIndex = inventoryList.findIndex(inv => inv.id === oldItem.itemId);
                        if (itemIndex > -1) {
                            // Revert stock change
                            inventoryList[itemIndex].stock = (inventoryList[itemIndex].stock || 0) - oldItem.quantity;
                            
                            // Remove history entries associated with this slip
                            inventoryList[itemIndex].priceHistory = (inventoryList[itemIndex].priceHistory || []).filter(ph => ph.sourceId !== id);
                            inventoryList[itemIndex].stockHistory = (inventoryList[itemIndex].stockHistory || []).filter(sh => sh.sourceId !== id);

                            // Recalculate unitPrice based on the latest history entry left
                            const priceHistory = inventoryList[itemIndex].priceHistory || [];
                            if (priceHistory.length > 0) {
                                // Sort to be sure the last one is the latest
                                priceHistory.sort((a,b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
                                inventoryList[itemIndex].unitPrice = priceHistory[priceHistory.length - 1].price;
                            } else {
                                inventoryList[itemIndex].unitPrice = 0; // Reset to default if no history left
                            }
                        }
                    });
                }
            }
    
            // Apply new changes
            slipData.items.forEach((newItem: ExpenseItem) => {
                const itemIndex = inventoryList.findIndex(inv => inv.id === newItem.itemId);
                if (itemIndex > -1) {
                    const item = inventoryList[itemIndex];
                    item.stock = (item.stock || 0) + newItem.quantity;
                    item.unitPrice = newItem.unitPrice; // Update current price
    
                    const priceHistoryEntry: PriceHistoryEntry = {
                        date: slipData.date,
                        price: newItem.unitPrice,
                        source: 'expense_slip',
                        sourceId: docRef.id,
                    };
                    item.priceHistory = [...(item.priceHistory || []), priceHistoryEntry];
    
                    const stockHistoryEntry: StockHistoryEntry = {
                        date: slipData.date,
                        change: newItem.quantity,
                        newStock: item.stock,
                        source: 'expense_slip',
                        sourceId: docRef.id,
                    };
                    item.stockHistory = [...(item.stockHistory || []), stockHistoryEntry];
                }
            });
    
            // Handle Photos
            if (photosToDelete && photosToDelete.length > 0) {
                await Promise.all(photosToDelete.map((url: string) => this.deletePhotoFromStorage(url)));
            }
            let newPhotoUrls: string[] = [];
            if (newPhotoIds && newPhotoIds.length > 0) {
                const uploadPromises = newPhotoIds.map(async (photoId: string) => {
                    const photoBlob = await photoStore.getPhoto(photoId);
                    if (!photoBlob) return null;
                    const storageRef = ref(storage, `expense-slips/${slipData.date || format(new Date(), 'yyyy-MM-dd')}/${uuidv4()}.jpg`);
                    await uploadBytes(storageRef, photoBlob);
                    return getDownloadURL(storageRef);
                });
                newPhotoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);
                await photoStore.deletePhotos(newPhotoIds);
            }
            const finalPhotos = [...(existingPhotos || []), ...newPhotoUrls];
    
            // Prepare slip data
            const finalData = { ...slipData, attachmentPhotos: finalPhotos };
            if (id) {
                finalData.lastModified = serverTimestamp();
            } else {
                finalData.createdAt = serverTimestamp();
                finalData.date = format(new Date(), 'yyyy-MM-dd');
            }
    
            // Commit all changes
            transaction.set(inventoryDocRef, { items: inventoryList });
            transaction.set(docRef, finalData, { merge: true });
        });
    },
    
    async deleteExpenseSlip(slip: ExpenseSlip): Promise<void> {
        await runTransaction(db, async (transaction) => {
            const inventoryDocRef = doc(db, 'app-data', 'inventoryList');
            const inventorySnap = await transaction.get(inventoryDocRef);
            if (!inventorySnap.exists()) {
                throw new Error("Không tìm thấy danh sách hàng tồn kho.");
            }
            const inventoryList = (inventorySnap.data() as { items: InventoryItem[] }).items;

            // Revert stock and history
            slip.items.forEach(item => {
                const itemIndex = inventoryList.findIndex(inv => inv.id === item.itemId);
                if (itemIndex > -1) {
                    inventoryList[itemIndex].stock = (inventoryList[itemIndex].stock || 0) - item.quantity;
                    inventoryList[itemIndex].priceHistory = (inventoryList[itemIndex].priceHistory || []).filter(ph => ph.sourceId !== slip.id);
                    inventoryList[itemIndex].stockHistory = (inventoryList[itemIndex].stockHistory || []).filter(sh => sh.sourceId !== slip.id);
                    // Re-evaluate unitPrice
                    const priceHistory = inventoryList[itemIndex].priceHistory || [];
                     if (priceHistory.length > 0) {
                        priceHistory.sort((a,b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
                        inventoryList[itemIndex].unitPrice = priceHistory[priceHistory.length - 1].price;
                    } else {
                        inventoryList[itemIndex].unitPrice = 0;
                    }
                }
            });

            // Delete photos
            if (slip.attachmentPhotos && slip.attachmentPhotos.length > 0) {
                await Promise.all(slip.attachmentPhotos.map(url => this.deletePhotoFromStorage(url)));
            }

            // Commit inventory changes and delete slip
            transaction.set(inventoryDocRef, { items: inventoryList });
            transaction.delete(doc(db, 'expense_slips', slip.id));
        });
    },
    
    subscribeToAllExpenseSlips(callback: (slips: ExpenseSlip[]) => void): () => void {
        const q = query(collection(db, 'expense_slips'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snapshot => {
            const slips = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as ExpenseSlip));
            callback(slips);
        });
    },

    subscribeToAllIncidents(callback: (incidents: IncidentReport[]) => void): () => void {
        const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snapshot => {
            const incidents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as IncidentReport));
            callback(incidents);
        });
    },

    subscribeToAllRevenueStats(callback: (stats: RevenueStats[]) => void): () => void {
        const q = query(collection(db, 'revenue_stats'), orderBy('date', 'desc'));
        return onSnapshot(q, snapshot => {
            const stats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as RevenueStats));
            callback(stats);
        });
    },


     // --- End Cashier ---
     // --- Notifications ---
    subscribeToAllNotifications(callback: (notifications: Notification[]) => void): () => void {
        const notificationsCollection = collection(db, 'notifications');
        const q = query(notificationsCollection, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const now = new Date();
            const expiredRequests: Notification[] = [];

            const notifications: Notification[] = querySnapshot.docs.map(doc => {
                 const data = doc.data();
                const notification = {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                    resolvedAt: (data.resolvedAt as Timestamp)?.toDate()?.toISOString(),
                } as Notification;
                
                // Identify expired pass requests
                if (notification.type === 'pass_request' && (notification.status === 'pending' || notification.status === 'pending_approval')) {
                    const shiftDateTime = parseISO(`${notification.payload.shiftDate}T${notification.payload.shiftTimeSlot.start}`);
                    if (isPast(shiftDateTime)) {
                        expiredRequests.push(notification);
                    }
                }
                
                return notification;
            });
            
            // Automatically cancel expired requests
            if (expiredRequests.length > 0) {
                const batch = writeBatch(db);
                expiredRequests.forEach(req => {
                    const docRef = doc(db, 'notifications', req.id);
                    batch.update(docRef, {
                        status: 'cancelled',
                        'payload.cancellationReason': 'Tự động hủy do đã quá hạn.',
                        resolvedAt: serverTimestamp(),
                    });
                });
                batch.commit().catch(e => console.error("Failed to auto-cancel expired pass requests:", e));
            }

            callback(notifications);

        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read notifications: ${error.code}`);
            callback([]);
        });

        return unsubscribe;
    },

    subscribeToRelevantNotifications(userId: string, userRole: UserRole, callback: (notifications: Notification[]) => void): () => void {
        const notificationsCollection = collection(db, 'notifications');
        
        const myRequestsQuery = query(
            notificationsCollection,
            or(
                where('payload.requestingUser.userId', '==', userId),
                where('payload.targetUserId', '==', userId),
                where('payload.takenBy.userId', '==', userId)
            )
        );

        const otherRequestsQuery = query(
            notificationsCollection,
            and(
                where('status', '==', 'pending'),
                where('payload.requestingUser.userId', '!=', userId)
            )
        );

        const processResults = (myRequests: Notification[], otherRequests: Notification[]) => {
            const combined = new Map<string, Notification>();
            
            myRequests.forEach(n => {
                 if (n.type === 'pass_request' && (n.status === 'pending' || n.status === 'pending_approval')) {
                    const shiftDateTime = parseISO(`${n.payload.shiftDate}T${n.payload.shiftTimeSlot.start}`);
                    if (isPast(shiftDateTime)) {
                        // Cancel my own expired request
                        const docRef = doc(db, 'notifications', n.id);
                        updateDoc(docRef, {
                            status: 'cancelled',
                            'payload.cancellationReason': 'Tự động hủy do đã quá hạn.',
                            resolvedAt: serverTimestamp(),
                        }).catch(e => console.error("Failed to auto-cancel own expired request:", e));
                        return; // Don't show it in the UI immediately
                    }
                }
                combined.set(n.id, n);
            });

            otherRequests.forEach(n => {
                const payload = n.payload;
                if (n.type === 'pass_request' && n.status === 'pending') {
                    const shiftDateTime = parseISO(`${payload.shiftDate}T${payload.shiftTimeSlot.start}`);
                    if (isPast(shiftDateTime)) {
                        return; // Don't show expired requests from others
                    }
                }
                if (payload.targetUserId) return;
                const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && userRole !== payload.shiftRole;
                const hasDeclined = (payload.declinedBy || []).includes(userId);
                if (!isDifferentRole && !hasDeclined) {
                    combined.set(n.id, n);
                }
            });

            const finalNotifications = Array.from(combined.values())
                .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
                
            callback(finalNotifications);
        };

        let myRequestsCache: Notification[] = [];
        let otherRequestsCache: Notification[] = [];
        
        const unsubMyRequests = onSnapshot(myRequestsQuery, (snapshot) => {
            myRequestsCache = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                resolvedAt: (doc.data().resolvedAt as Timestamp)?.toDate()?.toISOString(),
            } as Notification));
            processResults(myRequestsCache, otherRequestsCache);
        }, (error) => console.error("Error fetching my pass requests:", error));
        
        const unsubOtherRequests = onSnapshot(otherRequestsQuery, (snapshot) => {
            otherRequestsCache = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                resolvedAt: (doc.data().resolvedAt as Timestamp)?.toDate()?.toISOString(),
            } as Notification));
            processResults(myRequestsCache, otherRequestsCache);
        }, (error) => console.error("Error fetching other pass requests:", error));
        
        return () => {
            unsubMyRequests();
            unsubOtherRequests();
        };
    },

    async updateNotificationStatus(notificationId: string, status: Notification['status'], resolver?: AuthUser): Promise<void> {
        const docRef = doc(db, 'notifications', notificationId);
        const updateData: any = { status, resolvedAt: serverTimestamp() };
        if (resolver) {
            updateData.resolvedBy = { userId: resolver.uid, userName: resolver.displayName };
        }
        if (status === 'cancelled') {
            updateData['payload.cancellationReason'] = 'Hủy bởi quản lý';
        }
        await updateDoc(docRef, updateData);
    },

    async deleteNotification(notificationId: string): Promise<void> {
        const docRef = doc(db, 'notifications', notificationId);
        await deleteDoc(docRef);
    },

    // --- Schedule ---
    subscribeToSchedule(weekId: string, callback: (schedule: Schedule | null) => void): () => void {
        const docRef = doc(db, 'schedules', weekId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const scheduleData = docSnap.data() as Schedule;

                // Merge overlapping/adjacent availability slots upon loading
                if (scheduleData.availability) {
                    const availabilityByUser = new Map<string, Availability>();
                    scheduleData.availability.forEach(avail => {
                        const key = `${avail.userId}-${avail.date}`;
                        if (!availabilityByUser.has(key)) {
                            availabilityByUser.set(key, { ...avail, availableSlots: [] });
                        }
                        // This logic has a potential issue. If a user registers [8-12, 13-17], and then separately [12-13],
                        // they will all be added here.
                        availabilityByUser.get(key)!.availableSlots.push(...avail.availableSlots);
                    });
                    
                    const mergedAvailability: Availability[] = [];
                    availabilityByUser.forEach((userAvail) => {
                         if (userAvail.availableSlots.length > 1) {
                            const sortedSlots = [...userAvail.availableSlots].sort((a, b) => a.start.localeCompare(b.start));
                            const result: TimeSlot[] = [sortedSlots[0]];
                            
                            for (let i = 1; i < sortedSlots.length; i++) {
                                const lastMerged = result[result.length - 1];
                                const current = sortedSlots[i];
                                // Merge if current slot starts before or at the same time the last one ends
                                if (current.start <= lastMerged.end) {
                                    // Extend the end time if the current slot ends later
                                    lastMerged.end = current.end > lastMerged.end ? current.end : lastMerged.end;
                                } else {
                                    result.push(current);
                                }
                            }
                            userAvail.availableSlots = result;
                        }
                        mergedAvailability.push(userAvail);
                    });
                    scheduleData.availability = mergedAvailability;
                }

                callback(scheduleData);
            } else {
                callback(null);
            }
        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read schedule for ${weekId}: ${error.code}`);
            callback(null);
        });
        return unsubscribe;
    },

    subscribeToAllSchedules(callback: (schedules: Schedule[]) => void): () => void {
        const q = query(collection(db, 'schedules'), orderBy('weekId', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const schedules = snapshot.docs.map(doc => ({...doc.data(), weekId: doc.id} as Schedule));
            callback(schedules);
        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read all schedules: ${error.code}`);
            callback([]);
        });
        return unsubscribe;
    },

    async getSchedulesForMonth(date: Date): Promise<Schedule[]> {
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);

        const weeks = eachWeekOfInterval({
            start: monthStart,
            end: monthEnd,
        }, { weekStartsOn: 1 });

        const weekIds = weeks.map(weekStart => `${getYear(weekStart)}-W${getISOWeek(weekStart)}`);

        const schedulePromises = weekIds.map(weekId => getDoc(doc(db, 'schedules', weekId)));
        const scheduleDocs = await Promise.all(schedulePromises);

        return scheduleDocs
            .filter(docSnap => docSnap.exists())
            .map(docSnap => ({...docSnap.data(), weekId: docSnap.id} as Schedule));
    },

    async updateSchedule(weekId: string, data: Partial<Schedule>): Promise<void> {
        const docRef = doc(db, 'schedules', weekId);
        await setDoc(docRef, data, { merge: true });
    },

    async createDraftScheduleForNextWeek(currentDate: Date, shiftTemplates: ShiftTemplate[]): Promise<void> {
        const nextWeekDate = addDays(currentDate, 7);
        const nextWeekId = `${nextWeekDate.getFullYear()}-W${getISOWeek(nextWeekDate)}`;
    
        const scheduleRef = doc(db, 'schedules', nextWeekId);
        const scheduleSnap = await getDoc(scheduleRef);
    
        if (scheduleSnap.exists()) {
            const scheduleData = scheduleSnap.data() as Schedule;
            const validStatus: Schedule['status'][] = ['draft', 'proposed', 'published'];
            if (!scheduleData.status || !validStatus.includes(scheduleData.status)) {
                await updateDoc(scheduleRef, { status: 'draft' });
            }
            return;
        }
    
        const startOfNextWeek = startOfWeek(nextWeekDate, { weekStartsOn: 1 });
        const endOfNextWeek = endOfWeek(nextWeekDate, { weekStartsOn: 1 });
        const daysInNextWeek = eachDayOfInterval({ start: startOfNextWeek, end: endOfNextWeek });
    
        const newShifts: AssignedShift[] = [];
        daysInNextWeek.forEach(day => {
            const dayOfWeek = getDay(day);
            const dateKey = format(day, 'yyyy-MM-dd');
    
            shiftTemplates.forEach(template => {
                if ((template.applicableDays || []).includes(dayOfWeek)) {
                    newShifts.push({
                        id: `shift_${dateKey}_${template.id}`,
                        templateId: template.id,
                        date: dateKey,
                        label: template.label,
                        role: template.role,
                        timeSlot: template.timeSlot,
                        minUsers: template.minUsers ?? 0,
                        assignedUsers: [],
                    });
                }
            });
        });
    
        const newSchedule: Schedule = {
            weekId: nextWeekId,
            status: 'draft',
            availability: [],
            shifts: newShifts.sort((a, b) => {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                return a.timeSlot.start.localeCompare(b.timeSlot.start);
            }),
        };
    
        await setDoc(scheduleRef, newSchedule);
    },
    
    subscribeToShiftTemplates(callback: (templates: ShiftTemplate[]) => void): () => void {
        const docRef = doc(db, 'app-data', 'shiftTemplates');
        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data().templates as ShiftTemplate[]);
            } else {
                try {
                    await setDoc(docRef, { templates: [] });
                    callback([]);
                } catch(e) {
                    console.error("Permission denied to create default shift templates.", e);
                    callback([]);
                }
            }
        }, (error) => {
            console.warn(`[Firestore Read Error] Could not read shift templates: ${error.code}`);
            callback([]);
        });
        return unsubscribe;
    },
    
    async updateShiftTemplates(templates: ShiftTemplate[]): Promise<void> {
        const docRef = doc(db, 'app-data', 'shiftTemplates');
        await setDoc(docRef, { templates });
    },
    
    async requestPassShift(shiftToPass: AssignedShift, requestingUser: { uid: string, displayName: string }): Promise<void> {
        const existingRequestQuery = query(
            collection(db, 'notifications'),
            where('type', '==', 'pass_request'),
            where('payload.shiftId', '==', shiftToPass.id),
            where('payload.requestingUser.userId', '==', requestingUser.uid),
            where('status', 'in', ['pending', 'pending_approval'])
        );

        const existingRequestsSnapshot = await getDocs(existingRequestQuery);
        if (!existingRequestsSnapshot.empty) {
            throw new Error('Bạn đã có một yêu cầu pass ca đang chờ cho ca làm việc này.');
        }


        const weekId = `${new Date(shiftToPass.date).getFullYear()}-W${getISOWeek(new Date(shiftToPass.date))}`;
        const newNotification: Omit<Notification, 'id'> = {
            type: 'pass_request',
            status: 'pending',
            createdAt: serverTimestamp(),
            payload: {
                weekId: weekId,
                shiftId: shiftToPass.id,
                shiftLabel: shiftToPass.label,
                shiftDate: shiftToPass.date,
                shiftTimeSlot: shiftToPass.timeSlot,
                shiftRole: shiftToPass.role,
                requestingUser: {
                    userId: requestingUser.uid,
                    userName: requestingUser.displayName
                },
                declinedBy: [],
            }
        };
        await addDoc(collection(db, "notifications"), newNotification);
    },

    async requestDirectPassShift(shiftToPass: AssignedShift, requestingUser: AuthUser, targetUser: ManagedUser): Promise<void> {
        const existingRequestQuery = query(
            collection(db, 'notifications'),
            where('type', '==', 'pass_request'),
            where('payload.shiftId', '==', shiftToPass.id),
            where('payload.requestingUser.userId', '==', requestingUser.uid),
            where('payload.targetUserId', '==', targetUser.uid),
            where('status', 'in', ['pending', 'pending_approval'])
        );
        const existingRequestsSnapshot = await getDocs(existingRequestQuery);
        if (!existingRequestsSnapshot.empty) {
            throw new Error(`Bạn đã gửi yêu cầu cho ${targetUser.displayName} rồi.`);
        }

        const weekId = `${new Date(shiftToPass.date).getFullYear()}-W${getISOWeek(new Date(shiftToPass.date))}`;
        const newNotification: Omit<Notification, 'id'> = {
            type: 'pass_request',
            status: 'pending',
            createdAt: serverTimestamp(),
            payload: {
                weekId: weekId,
                shiftId: shiftToPass.id,
                shiftLabel: shiftToPass.label,
                shiftDate: shiftToPass.date,
                shiftTimeSlot: shiftToPass.timeSlot,
                shiftRole: shiftToPass.role,
                requestingUser: {
                    userId: requestingUser.uid,
                    userName: requestingUser.displayName
                },
                targetUserId: targetUser.uid, // Add the target user ID
                declinedBy: [],
            }
        };
        await addDoc(collection(db, "notifications"), newNotification);
    },

    async revertPassRequest(notification: Notification, resolver: AuthUser): Promise<void> {
        const { payload } = notification;
        const scheduleRef = doc(db, "schedules", payload.weekId);

        await runTransaction(db, async (transaction) => {
            const scheduleDoc = await transaction.get(scheduleRef);
            if (!scheduleDoc.exists()) throw new Error("Không tìm thấy lịch làm việc.");

            // 1. Revert assigned users in schedule
            const scheduleData = scheduleDoc.data() as Schedule;
            const updatedShifts = scheduleData.shifts.map(s => {
                if (s.id === payload.shiftId) {
                    let updatedAssignedUsers = [...s.assignedUsers];
                    if (payload.takenBy) {
                        updatedAssignedUsers = updatedAssignedUsers.filter(u => u.userId !== payload.takenBy!.userId);
                    }
                    if (!updatedAssignedUsers.some(u => u.userId === payload.requestingUser.userId)) {
                        updatedAssignedUsers.push(payload.requestingUser);
                    }
                    return { ...s, assignedUsers: updatedAssignedUsers };
                }
                return s;
            });
             transaction.update(scheduleRef, { shifts: updatedShifts });

            // 2. Revert notification status
            const notificationRef = doc(db, "notifications", notification.id);
            transaction.update(notificationRef, {
                status: 'pending',
                resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
                resolvedAt: serverTimestamp(),
                'payload.takenBy': null,
                 cancellationReason: null, // Clear cancellation reason
            });
        });
    },

    async acceptPassShift(notificationId: string, acceptingUser: AssignedUser): Promise<void> {
        const notificationRef = doc(db, "notifications", notificationId);
        await updateDoc(notificationRef, {
            status: 'pending_approval',
            'payload.takenBy': acceptingUser
        });
    },

    async approvePassRequest(notification: Notification, resolver: AuthUser): Promise<void> {
        const scheduleRef = doc(db, "schedules", notification.payload.weekId);
        const notificationRef = doc(db, "notifications", notification.id);
        const takenBy = notification.payload.takenBy;
    
        if (!takenBy) {
            throw new Error("Không có người nhận ca để phê duyệt.");
        }
    
        await runTransaction(db, async (transaction) => {
            const scheduleDoc = await transaction.get(scheduleRef);
            if (!scheduleDoc.exists()) {
                throw new Error("Không tìm thấy lịch làm việc để kiểm tra xung đột.");
            }
            const scheduleData = scheduleDoc.data() as Schedule;
            
            // Check if original requester is still in the shift
            const shiftToUpdate = scheduleData.shifts.find(s => s.id === notification.payload.shiftId);
            if (!shiftToUpdate) {
                throw new Error("Không tìm thấy ca làm việc này trong lịch.");
            }
            const isRequesterStillAssigned = shiftToUpdate.assignedUsers.some(u => u.userId === notification.payload.requestingUser.userId);
            
            if (!isRequesterStillAssigned) {
                // The shift was already taken by someone else and approved.
                // Cancel this now-redundant notification.
                transaction.update(notificationRef, {
                    status: 'cancelled',
                    'payload.cancellationReason': 'Ca làm việc này đã được người khác đảm nhận.',
                    resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
                    resolvedAt: serverTimestamp(),
                });
                throw new Error("ALREADY_RESOLVED: Ca làm việc này đã được người khác đảm nhận.");
            }
    
            // Check for time conflicts for the accepting user
            const allShiftsOnDay = scheduleData.shifts.filter(s => s.date === notification.payload.shiftDate);
            const shiftToTake: AssignedShift = { ...shiftToUpdate, assignedUsers: [] };
            const conflict = hasTimeConflict(takenBy.userId, shiftToTake, allShiftsOnDay);
            
            if (conflict) {
                transaction.update(notificationRef, {
                    status: 'cancelled',
                    'payload.cancellationReason': `Tự động hủy do người nhận ca (${takenBy.userName}) bị trùng lịch.`,
                    'payload.takenBy': null,
                    resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
                    resolvedAt: serverTimestamp(),
                });
                throw new Error(`SHIFT_CONFLICT: Nhân viên ${takenBy.userName} đã có ca làm việc khác (${conflict.label}) bị trùng giờ.`);
            }
    
            // Update Schedule
            const updatedShifts = scheduleData.shifts.map(s => {
                if (s.id === shiftToUpdate.id) {
                    const newAssignedUsers = s.assignedUsers.filter(u => u.userId !== notification.payload.requestingUser.userId);
                    if (!newAssignedUsers.some(u => u.userId === takenBy.userId)) {
                        newAssignedUsers.push(takenBy);
                    }
                    return { ...s, assignedUsers: newAssignedUsers };
                }
                return s;
            });
            transaction.update(scheduleRef, { shifts: updatedShifts });
            
            // Update the approved Notification
            transaction.update(notificationRef, {
                status: 'resolved',
                resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
                resolvedAt: serverTimestamp(),
            });

            // Find and cancel all other related pending requests for this shift
            const otherRequestsQuery = query(
                collection(db, 'notifications'),
                and(
                    where('type', '==', 'pass_request'),
                    where('payload.shiftId', '==', notification.payload.shiftId),
                    where('payload.requestingUser.userId', '==', notification.payload.requestingUser.userId),
                    or(where('status', '==', 'pending'), where('status', '==', 'pending_approval'))
                )
            );

            const otherRequestsSnapshot = await getDocs(otherRequestsQuery);
            otherRequestsSnapshot.forEach(doc => {
                // Don't cancel the one we are currently approving
                if (doc.id !== notification.id) {
                    transaction.update(doc.ref, {
                        status: 'cancelled',
                        'payload.cancellationReason': 'Đã có người khác nhận và được phê duyệt.',
                        resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
                        resolvedAt: serverTimestamp(),
                    });
                }
            });
        });
    },
    
    async rejectPassRequestApproval(notificationId: string, resolver: AuthUser): Promise<void> {
        const notificationRef = doc(db, "notifications", notificationId);
        await updateDoc(notificationRef, {
            status: 'pending',
            resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
            resolvedAt: serverTimestamp(),
            'payload.takenBy': null
        });
    },

    async declinePassShift(notificationId: string, decliningUserId: string): Promise<void> {
        const notificationRef = doc(db, "notifications", notificationId);
        await runTransaction(db, async (transaction) => {
            const notificationDoc = await transaction.get(notificationRef);
            if (!notificationDoc.exists()) throw new Error("Notification not found");
            const existingDeclined = notificationDoc.data().payload.declinedBy || [];
            const newDeclined = Array.from(new Set([...existingDeclined, decliningUserId]));
            transaction.update(notificationRef, { 'payload.declinedBy': newDeclined });
        });
    },

    async resolvePassRequestByAssignment(notification: Notification, assignedUser: AssignedUser, resolver: AuthUser): Promise<void> {
        const scheduleRef = doc(db, "schedules", notification.payload.weekId);
        const notificationRef = doc(db, "notifications", notification.id);

        await runTransaction(db, async (transaction) => {
            const scheduleDoc = await transaction.get(scheduleRef);
            if (!scheduleDoc.exists()) {
                throw new Error("Không tìm thấy lịch làm việc.");
            }

            // 1. Update Schedule
            const scheduleData = scheduleDoc.data() as Schedule;
            const updatedShifts = scheduleData.shifts.map(s => {
                if (s.id === notification.payload.shiftId) {
                    // Replace the requesting user with the newly assigned user
                    const newAssignedUsers = s.assignedUsers.filter(u => u.userId !== notification.payload.requestingUser.userId);
                    if (!newAssignedUsers.some(u => u.userId === assignedUser.userId)) {
                        newAssignedUsers.push(assignedUser);
                    }
                    return { ...s, assignedUsers: newAssignedUsers };
                }
                return s;
            });
            transaction.update(scheduleRef, { shifts: updatedShifts });

            // 2. Update Notification
            transaction.update(notificationRef, {
                status: 'resolved',
                'payload.takenBy': assignedUser,
                resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
                resolvedAt: serverTimestamp(),
            });
        });
    },
    
    // --- End Schedule ---
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

        // Query and delete old inventory reports
        const inventoryReportsQuery = query(
            collection(db, "inventory-reports"),
            where("submittedAt", "<", cutoffTimestamp)
        );
        const inventoryReportsSnapshot = await getDocs(inventoryReportsQuery);
        for (const reportDoc of inventoryReportsSnapshot.docs) {
            await this.deleteInventoryReport(reportDoc.id);
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
            generatedAt: serverTimestamp(),
        };
        await setDoc(docRef, data);
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
            callback({ isRegistrationEnabled: false }); // Default to false on error
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

  async logErrorToServer(error: AppError) {
    try {
      const errorCollection = collection(db, 'errors');
      await addDoc(errorCollection, {
        ...error,
        timestamp: serverTimestamp(),
      });
    } catch (loggingError) {
      console.error("FATAL: Could not log error to server.", loggingError);
    }
  },

  subscribeToErrorLog(callback: (errors: AppError[]) => void): () => void {
    const errorsCollection = collection(db, 'errors');
    const q = query(errorsCollection, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const errors: AppError[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        errors.push({
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as AppError);
      });
      callback(errors);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read error log: ${error.code}`);
        callback([]); // Return empty array on permission error
    });

    return unsubscribe;
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
            await setDoc(docRef, { tasks: initialComprehensiveTasks });
            callback(initialComprehensiveTasks);
        } catch(e) {
            console.error("Permission denied to create default comprehensive tasks.", e);
            callback(initialComprehensiveTasks);
        }
      }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read comprehensive tasks: ${error.code}`);
        callback(initialComprehensiveTasks);
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
            unitPrice: item.unitPrice ?? 0,
            stock: item.stock ?? 0,
            priceHistory: item.priceHistory ?? [],
            stockHistory: item.stockHistory ?? [],
        }));
    }
    return initialInventoryList;
  },

  subscribeToInventoryList(callback: (items: InventoryItem[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'inventoryList');
     const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const items = docSnap.data().items as InventoryItem[];
        // Data sanitization step to ensure data consistency
        const sanitizedItems = items.map(item => ({
          ...item,
          supplier: item.supplier ?? 'Chưa xác định',
          category: item.category ?? 'CHƯA PHÂN LOẠI',
          dataType: item.dataType || 'number',
          listOptions: item.listOptions || ['hết', 'gần hết', 'còn đủ', 'dư xài'],
          unitPrice: Number(item.unitPrice) || 0,
          stock: Number(item.stock) || 0,
          priceHistory: item.priceHistory ?? [],
          stockHistory: item.stockHistory ?? [],
        }));
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

    await runTransaction(db, async (transaction) => {
        const inventoryDocRef = doc(db, 'app-data', 'inventoryList');
        const inventorySnap = await transaction.get(inventoryDocRef);
        if (!inventorySnap.exists()) throw new Error("Inventory list not found");
        
        const inventoryList = (inventorySnap.data() as { items: InventoryItem[] }).items;
        
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
            await uploadBytes(storageRef, photoBlob);
            return { photoId, downloadURL: await getDownloadURL(storageRef) };
        });
        const uploadResults = await Promise.all(uploadPromises);
        const photoIdToUrlMap = new Map(uploadResults.map(r => [r.photoId, r.downloadURL]).filter(r => r[1]));

        for (const itemId in reportToSubmit.stockLevels) {
            const record = reportToSubmit.stockLevels[itemId];
            if (record.photoIds) {
                const finalUrls = record.photoIds.map((id: string) => photoIdToUrlMap.get(id)).filter(Boolean);
                record.photos = Array.from(new Set([...(record.photos || []), ...finalUrls]));
                delete record.photoIds;
            }

            // Update inventory list and create stock history
            const itemIndex = inventoryList.findIndex(inv => inv.id === itemId);
            if (itemIndex > -1) {
                const currentStock = inventoryList[itemIndex].stock;
                const newStock = Number(record.stock);
                if (!isNaN(newStock) && newStock !== currentStock) {
                    const stockHistoryEntry: StockHistoryEntry = {
                        date: report.date,
                        change: newStock - currentStock,
                        newStock: newStock,
                        source: 'inventory_check',
                        sourceId: report.id,
                        notes: 'Điều chỉnh sau kiểm kê',
                    };
                    inventoryList[itemIndex].stock = newStock;
                    inventoryList[itemIndex].stockHistory = [...(inventoryList[itemIndex].stockHistory || []), stockHistoryEntry];
                }
            }
        }

        // Finalize report data
        reportToSubmit.lastUpdated = serverTimestamp();
        reportToSubmit.submittedAt = serverTimestamp();
        delete reportToSubmit.id;

        // Commit all changes
        transaction.set(inventoryDocRef, { items: inventoryList });
        const firestoreRef = doc(db, 'inventory-reports', report.id);
        transaction.set(firestoreRef, reportToSubmit, { merge: true });

        // Cleanup local data
        await photoStore.deletePhotos(Array.from(photoIdsToUpload));
        if (typeof window !== 'undefined') {
            localStorage.removeItem(report.id);
        }
    });
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
      const deletePromises: Promise<void>[] = [];
      for (const taskId in reportData.completedTasks) {
        for (const completion of reportData.completedTasks[taskId]) {
          if (completion.photos) {
            for (const photoUrl of completion.photos) {
              deletePromises.push(this.deletePhotoFromStorage(photoUrl));
            }
          }
        }
      }
      await Promise.all(deletePromises);
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
        await uploadBytes(storageRef, photoBlob);
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
         const timeB = new Date(b.submittedAt as string).getTime();
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
          const timeB = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
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
          const timeB = b.submittedAt ? new Date(b.submittedAt as string).getTime() : 0;
          return timeB - timeA;
        });
        return reports;
    } catch (error: any) {
        console.warn(`[Firestore Read Error] Could not read hygiene reports for date ${date}: ${error.code}`);
        return [];
    }
  },

  subscribeToViolations(callback: (violations: Violation[]) => void): () => void {
    const violationsCollection = collection(db, 'violations');
    const q = query(violationsCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const violations: Violation[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        violations.push({
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          penaltySubmittedAt: (data.penaltySubmittedAt as Timestamp)?.toDate()?.toISOString(),
        } as Violation);
      });
      callback(violations);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read violations: ${error.code}`);
        callback([]);
    });

    return unsubscribe;
  },
  
  subscribeToViolationCategories(callback: (categories: ViolationCategory[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'violationCategories');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if(docSnap.exists()) {
            callback(docSnap.data().list as ViolationCategory[]);
        } else {
            try {
                await setDoc(docRef, { list: initialViolationCategories });
                callback(initialViolationCategories);
            } catch(e) {
                console.error("Permission denied to create default violation categories.", e);
                callback(initialViolationCategories);
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read violation categories: ${error.code}`);
        callback(initialViolationCategories);
    });
    return unsubscribe;
  },

  async updateViolationCategories(newCategories: ViolationCategory[]) {
    const docRef = doc(db, 'app-data', 'violationCategories');
    await setDoc(docRef, { list: newCategories });
  },

  async addOrUpdateViolation(
    violationData: Omit<Violation, 'id' | 'createdAt' | 'photos' | 'penaltySubmittedAt'> & { photosToUpload: string[] },
    id?: string
  ): Promise<void> {
    const { photosToUpload, ...data } = violationData;

    // 1. Upload photos if any
    const uploadPromises = photosToUpload.map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) return null;
        const storageRef = ref(storage, `violations/${data.reporterId}/${uuidv4()}.jpg`);
        await uploadBytes(storageRef, blob);
        return getDownloadURL(storageRef);
    });
    
    const photoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);
    
    // 2. Prepare data for Firestore
    const finalData: Partial<Violation> = { ...data };

    if (!id) {
        finalData.createdAt = serverTimestamp();
        finalData.photos = photoUrls;
    } else {
        finalData.lastModified = serverTimestamp();
    }


    if (id) {
        const violationRef = doc(db, 'violations', id);
        const currentDoc = await getDoc(violationRef);
        if (currentDoc.exists()) {
            const existingPhotos = currentDoc.data().photos || [];
            finalData.photos = [...existingPhotos, ...photoUrls];
        } else {
            finalData.photos = photoUrls;
        }
        await updateDoc(violationRef, finalData);
    } else {
        await addDoc(collection(db, 'violations'), finalData);
    }
    
    await photoStore.deletePhotos(photosToUpload);
  },
  
  async deleteViolation(violation: Violation): Promise<void> {
    const allPhotoUrls: string[] = [];
    if (violation.photos) {
      allPhotoUrls.push(...violation.photos);
    }
    if (violation.penaltyPhotos) {
      allPhotoUrls.push(...violation.penaltyPhotos);
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
        await uploadBytes(storageRef, blob);
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
            if (!violationDoc.exists()) {
                throw new Error("Violation not found.");
            }
            const violation = violationDoc.data() as Violation;
            const comments = violation.comments || [];
            const commentToDelete = comments.find(c => c.id === commentId);

            if (!commentToDelete) {
                // Comment might have already been deleted.
                return;
            }

            // Delete associated photos from storage first
            if (commentToDelete.photos && commentToDelete.photos.length > 0) {
                await Promise.all(commentToDelete.photos.map(url => this.deletePhotoFromStorage(url)));
            }

            // Update the comments array in Firestore
            const updatedComments = comments.filter(c => c.id !== commentId);
            transaction.update(violationRef, { comments: updatedComments });
        });
    },
  
  async submitPenaltyProof(violationId: string, photoIds: string[]): Promise<string[]> {
    const uploadPromises = photoIds.map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) return null;
        const storageRef = ref(storage, `penalties/${violationId}/${uuidv4()}.jpg`);
        await uploadBytes(storageRef, blob);
        return getDownloadURL(storageRef);
    });
    
    const newPhotoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);

    if (newPhotoUrls.length === 0) {
        throw new Error("Failed to upload penalty proof photos.");
    }

    const violationRef = doc(db, 'violations', violationId);
    const currentDoc = await getDoc(violationRef);
    const existingPhotos = currentDoc.exists() ? (currentDoc.data().penaltyPhotos || []) : [];
    
    // Use a Set to ensure no duplicates before updating
    const updatedPhotos = Array.from(new Set([...existingPhotos, ...newPhotoUrls]));

    await updateDoc(violationRef, {
        penaltyPhotos: updatedPhotos,
        penaltySubmittedAt: serverTimestamp(),
    });

    await photoStore.deletePhotos(photoIds);
    return newPhotoUrls;
  },
};

