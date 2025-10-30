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
  addDoc,
  limit,
  deleteDoc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type {
  AuthUser,
  ExpenseSlip,
  IncidentReport,
  RevenueStats,
  ExpenseItem,
  OtherCostCategory,
  IncidentCategory,
  CashHandoverReport,
  ExtractHandoverDataOutput,
  FinalHandoverDetails,
  InventoryItem,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { photoStore } from './photo-store';
import { format } from 'date-fns';
import { uploadFile, deleteFileByUrl } from './data-store-helpers';

const getTodaysDateKey = () => {
    const now = new Date();
    // Get date parts for Vietnam's timezone (UTC+7)
    const year = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' });
    const month = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit' });
    const day = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit' });
    return `${year}-${month}-${day}`;
};

async function getInventoryList(): Promise<InventoryItem[]> {
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
    return [];
}

export function subscribeToHandoverReport(date: string, callback: (report: CashHandoverReport | CashHandoverReport[] | null) => void): () => void {
    const newReportsQuery = query(collection(db, 'cash_handover_reports'), where('date', '==', date), orderBy('createdAt', 'desc'));
    const unsubNewReports = onSnapshot(newReportsQuery, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashHandoverReport));
        callback(reports.length > 0 ? reports : null);
    }, (error) => {
        console.error("Lỗi khi lắng nghe báo cáo kiểm kê mới:", error);
        callback(null);
    });

    return () => {
        unsubNewReports();
    };
}

export async function getHandoverReport(date: string): Promise<CashHandoverReport | CashHandoverReport[] | null> {
    const newReportsQuery = query(collection(db, 'cash_handover_reports'), where('date', '==', date), orderBy('createdAt', 'asc'));
    const newReportsSnapshot = await getDocs(newReportsQuery);
    if (!newReportsSnapshot.empty) {
        return newReportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashHandoverReport));
    }
    return null;
}

export function subscribeToAllCashHandoverReports(callback: (reports: CashHandoverReport[]) => void): () => void {
    const q = query(collection(db, 'cash_handover_reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reports = snapshot.docs.map(doc => {
            return {
                id: doc.id,
                ...doc.data(),
            } as CashHandoverReport;
        });
        callback(reports);
    }, (error) => {
        console.error("Lỗi khi lắng nghe các biên bản kiểm kê tiền mặt:", error);
        callback([]);
    });
    return unsubscribe;
}

export async function finalizeHandover(
    handoverReceiptData: ExtractHandoverDataOutput & { imageDataUri: string },
    user: AuthUser
): Promise<void> {
    const date = getTodaysDateKey();

    const q = query(collection(db, 'cash_handover_reports'), where('date', '==', date), orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error("Không tìm thấy báo cáo kiểm kê tiền mặt nào trong ngày để hoàn tất bàn giao.");
    }
    const latestReportDoc = snapshot.docs[0];
    const latestReportRef = latestReportDoc.ref;

    let handoverImageUrl: string | null = null;
    if (handoverReceiptData.imageDataUri && handoverReceiptData.imageDataUri.startsWith('data:')) {
        const blob = await (await fetch(handoverReceiptData.imageDataUri)).blob();
        const storagePath = `final-handover-receipts/${date}/${uuidv4()}.jpg`;
        handoverImageUrl = await uploadFile(blob, storagePath);
    }

    const finalDetails: FinalHandoverDetails = {
        receiptData: handoverReceiptData,
        receiptImageUrl: handoverImageUrl,
        finalizedAt: serverTimestamp(),
        finalizedBy: { userId: user.uid, userName: user.displayName || 'N/A' },
    };
    await updateDoc(latestReportRef, { finalHandoverDetails: finalDetails });
}

export async function saveFinalHandoverDetails(
    data: any,
    user: AuthUser,
    reportId?: string,
    date?: string
): Promise<void> {
    const { handoverData, newPhotoIds, photosToDelete, shiftEndTime } = data;

    let reportRef;
    let reportDate = date;

    if (reportId) {
        reportRef = doc(db, 'cash_handover_reports', reportId);
        const reportSnap = await getDoc(reportRef);
        if (!reportSnap.exists()) throw new Error("Không tìm thấy báo cáo để cập nhật.");
        reportDate = reportSnap.data().date;
    } else if (date) {
        const q = query(collection(db, 'cash_handover_reports'), where('date', '==', date), orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) throw new Error("Không tìm thấy báo cáo kiểm kê tiền mặt nào trong ngày đã chọn.");
        reportRef = snapshot.docs[0].ref;
        reportId = snapshot.docs[0].id;
    } else {
        throw new Error("Cần `reportId` hoặc `date` để lưu chi tiết bàn giao.");
    }

    let imageUrl = (await getDoc(reportRef)).data()?.finalHandoverDetails?.receiptImageUrl || null;

    if (photosToDelete && photosToDelete.length > 0) {
        await Promise.all(photosToDelete.map((url: string) => deleteFileByUrl(url)));
        imageUrl = null;
    }

    if (newPhotoIds && newPhotoIds.length > 0) {
        const photoId = newPhotoIds[0];
        const photoBlob = await photoStore.getPhoto(photoId);
        if (photoBlob) {
            if (imageUrl) await deleteFileByUrl(imageUrl);
            imageUrl = await uploadFile(photoBlob, `final-handover-receipts/${reportDate}/${reportId}-${photoId}.jpg`);
            await photoStore.deletePhoto(photoId);
        }
    }

    const finalDetailsPayload = {
        'finalHandoverDetails.receiptImageUrl': imageUrl,
        'finalHandoverDetails.receiptData': { ...handoverData, shiftEndTime },
        'finalHandoverDetails.finalizedBy': { userId: user.uid, userName: user.displayName },
        'finalHandoverDetails.finalizedAt': serverTimestamp(),
    };

    await updateDoc(reportRef, finalDetailsPayload);
}

export async function addOrUpdateIncident(
  data: Omit<IncidentReport, 'id' | 'createdAt' | 'createdBy' | 'date'> & { photosToUpload?: string[], photosToDelete?: string[] },
  id: string | undefined,
  user: AuthUser
): Promise<void> {
    const { photosToUpload = [], photosToDelete = [], ...incidentData } = data;

    const uploadPromises = photosToUpload.map(async (photoId) => {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) return null;
        const storagePath = `incidents/${user.uid}/${uuidv4()}.jpg`;
        return uploadFile(photoBlob, storagePath);
    });
    const photoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);

    const finalData: Partial<IncidentReport> = { ...incidentData };

    if (id) {
        const docRef = doc(db, 'incidents', id);
        const currentDoc = await getDoc(docRef);
        if (currentDoc.exists()) {
            const existingPhotos = currentDoc.data().photos || [];
            const remainingPhotos = existingPhotos.filter((p: string) => !photosToDelete.includes(p));
            finalData.photos = [...remainingPhotos, ...photoUrls];
        } else {
            finalData.photos = photoUrls;
        }

        if (photosToDelete.length > 0) {
            await Promise.all(photosToDelete.map(url => deleteFileByUrl(url)));
        }

        await updateDoc(docRef, finalData);
    } else {
        finalData.date = (data as IncidentReport).date || getTodaysDateKey();
        finalData.createdAt = serverTimestamp() as Timestamp;
        finalData.createdBy = { userId: user.uid, userName: user.displayName };
        finalData.photos = photoUrls;

        await addDoc(collection(db, 'incidents'), finalData);
    }

    await photoStore.deletePhotos(photosToUpload);
}

export function subscribeToIncidentCategories(callback: (categories: IncidentCategory[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'incidentCategories');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().list as IncidentCategory[]);
        } else {
            try {
                await setDoc(docRef, { list: [] });
                callback([]);
            } catch (e) {
                console.error("Permission denied to create default incident categories.", e);
                callback([]);
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read incident categories: ${error.code}`);
        callback([]);
    });
    return unsubscribe;
}

export async function getIncidentCategories(): Promise<IncidentCategory[]> {
    const docRef = doc(db, 'app-data', 'incidentCategories');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data().list as IncidentCategory[];
    }
    return [];
}

export async function updateIncidentCategories(newCategories: IncidentCategory[]): Promise<void> {
    const docRef = doc(db, 'app-data', 'incidentCategories');
    await setDoc(docRef, { list: newCategories });
}

export function subscribeToOtherCostCategories(callback: (categories: OtherCostCategory[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'otherCostCategories');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().list as OtherCostCategory[]);
        } else {
            try {
                await setDoc(docRef, { list: [] });
                callback([]);
            } catch (e) {
                console.error("Permission denied to create default other cost categories.", e);
                callback([]);
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read other cost categories: ${error.code}`);
        callback([]);
    });
    return unsubscribe;
}

export async function getOtherCostCategories(): Promise<OtherCostCategory[]> {
    const docRef = doc(db, 'app-data', 'otherCostCategories');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data().list as OtherCostCategory[];
    }
    return [];
}

export async function updateOtherCostCategories(newCategories: OtherCostCategory[]): Promise<void> {
    const docRef = doc(db, 'app-data', 'otherCostCategories');
    await setDoc(docRef, { list: newCategories });
}

export function subscribeToDailyRevenueStats(date: string, callback: (stats: RevenueStats[]) => void): () => void {
    const q = query(collection(db, 'revenue_stats'), where('date', '==', date), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const stats = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as RevenueStats));
        callback(stats);
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read daily revenue stats: ${error.code}`);
        callback([]);
    });
}

export async function getDailyRevenueStats(date: string): Promise<RevenueStats[]> {
     const slipsCollection = collection(db, 'revenue_stats');
    const q = query(slipsCollection, where('date', '==', date), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    } as RevenueStats));
}

export async function addOrUpdateRevenueStats(data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, user: AuthUser, isEdited: boolean, documentId?: string): Promise<string> {
    const docRef = documentId ? doc(db, 'revenue_stats', documentId) : doc(collection(db, 'revenue_stats'));
    
    let finalData: Partial<RevenueStats> = {
        ...data,
        isEdited: isEdited,
    };

    if (data.invoiceImageUrl && data.invoiceImageUrl.startsWith('data:')) {
        const date = finalData.date || getTodaysDateKey();
        const blob = await (await fetch(data.invoiceImageUrl)).blob();
        const storagePath = `revenue-invoices/${date}/${uuidv4()}.jpg`;
        finalData.invoiceImageUrl = await uploadFile(blob, storagePath);
    } else if (data.invoiceImageUrl === null) {
         finalData.invoiceImageUrl = null;
    } else if (data.invoiceImageUrl === undefined) {
         delete finalData.invoiceImageUrl;
    }
    
    if (documentId) {
        finalData.lastModifiedBy = { userId: user.uid, userName: user.displayName || 'N/A' };
        await updateDoc(docRef, finalData);
    } else {
        finalData.date = (data as RevenueStats).date;
        finalData.createdBy = { userId: user.uid, userName: user.displayName || 'N/A' };
        finalData.createdAt = serverTimestamp() as Timestamp;
        await setDoc(docRef, finalData);
    }

    return docRef.id;
}

export async function deleteRevenueStats(id: string, user: AuthUser): Promise<void> {
    const docRef = doc(db, 'revenue_stats', id);
    if (!docRef) return;
    await deleteDoc(docRef);
}

export function subscribeToDailyExpenseSlips(date: string, callback: (slips: ExpenseSlip[]) => void): () => void {
    const slipsCollection = collection(db, 'expense_slips');
    const q = query(slipsCollection, where('date', '==', date), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
        const slips = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            lastModified: (doc.data().lastModified as Timestamp)?.toDate()?.toISOString(),
        } as ExpenseSlip));
        callback(slips);
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read daily expense slips: ${error.code}`);
        callback([]);
    });
}

export async function getDailyExpenseSlips(date: string): Promise<ExpenseSlip[]> {
     const slipsCollection = collection(db, 'expense_slips');
    const q = query(slipsCollection, where('date', '==', date), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    } as ExpenseSlip));
}

export async function addOrUpdateExpenseSlip(data: any, id?: string): Promise<void> {
    const docRef = id ? doc(db, 'expense_slips', id) : doc(collection(db, 'expense_slips'));
    const { existingPhotos, photosToDelete, newPhotoIds, ...slipData } = data;

    if (photosToDelete && photosToDelete.length > 0) {
        await Promise.all(photosToDelete.map((url: string) => deleteFileByUrl(url)));
    }
    let newPhotoUrls: string[] = [];
    if (newPhotoIds && newPhotoIds.length > 0) {
        const uploadPromises = newPhotoIds.map(async (photoId: string) => {
            const photoBlob = await photoStore.getPhoto(photoId);
            if (!photoBlob) return null;
            const storagePath = `expense-slips/${slipData.date || getTodaysDateKey()}/${uuidv4()}.jpg`;
            return uploadFile(photoBlob, storagePath);
        });
        newPhotoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);
        await photoStore.deletePhotos(newPhotoIds);
    }
    const finalPhotos = [...(existingPhotos || []), ...newPhotoUrls];

    const inventoryList = await getInventoryList();
            const itemsWithSupplier = slipData.items.map((item: ExpenseItem) => {
                if (item.itemId === 'other_cost') return item;
                const inventoryItem = inventoryList.find(i => i.id === item.itemId);
                return {
                    ...item,
                    supplier: inventoryItem?.supplier || 'Không rõ',
                };
            });
    
    slipData.items = itemsWithSupplier;

    slipData.totalAmount = itemsWithSupplier.reduce((sum: number, item: ExpenseItem) => sum + (item.quantity * item.unitPrice), 0) - (slipData.discount || 0);
   
    const finalData: Partial<ExpenseSlip> = { ...slipData, attachmentPhotos: finalPhotos };
    
    if (slipData.paymentMethod !== 'cash') {
        delete finalData.actualPaidAmount;
    }
    
    if (id) {
        finalData.lastModified = serverTimestamp() as Timestamp;
        if (slipData.lastModifiedBy) {
             finalData.lastModifiedBy = { userId: slipData.lastModifiedBy.userId, userName: slipData.lastModifiedBy.userName };
        }
    } else {
        finalData.createdAt = serverTimestamp() as Timestamp;
        finalData.date = slipData.date || getTodaysDateKey();
         if (!slipData.createdBy || !slipData.createdBy.userId) {
            console.error("Cannot create expense slip: createdBy information is missing or invalid.", slipData.createdBy);
            throw new Error(`Cannot create expense slip: createdBy information is missing or invalid. ${''}`);
        }
        if (slipData.paymentMethod === 'bank_transfer') {
            finalData.paymentStatus = 'unpaid';
        }

        finalData.createdBy = { userId: slipData.createdBy.userId, userName: slipData.createdBy.userName };
        delete finalData.lastModifiedBy;
    }

    await setDoc(docRef, finalData, { merge: true });
}

export async function deleteExpenseSlip(slip: ExpenseSlip): Promise<void> {
    if (slip.attachmentPhotos && slip.attachmentPhotos.length > 0) {
        await Promise.all(slip.attachmentPhotos.map(url => deleteFileByUrl(url)));
    }
    await deleteDoc(doc(db, 'expense_slips', slip.id));
}

export function subscribeToAllExpenseSlips(callback: (slips: ExpenseSlip[]) => void): () => void {
    const q = query(collection(db, 'expense_slips'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, async (snapshot) => {
            const inventoryItems: InventoryItem[] = await getInventoryList();
            const slips = snapshot.docs.map(doc => {
                const data = doc.data();
                const items = (data.items || []).map((item: ExpenseItem) => {
                    const inventoryItem = inventoryItems.find(i => i.id === item.itemId);
                    let quantityInBaseUnit = item.quantity;
                    if (inventoryItem && inventoryItem.units) {
                        const unitDef = inventoryItem.units.find(u => u.name === item.unit);
                        if(unitDef && unitDef.conversionRate) {
                           quantityInBaseUnit *= unitDef.conversionRate;
                        }
                    }
                    return { ...item, quantityInBaseUnit, supplier: inventoryItem?.supplier || 'Không rõ' };
                });
                return {
                    id: doc.id,
                    ...data,
                    items,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                    lastModified: (data.lastModified as Timestamp)?.toDate()?.toISOString(),
                } as ExpenseSlip;
            });
            callback(slips);
    });
}

export async function markSupplierDebtsAsPaid(debts: { slipId: string, supplier: string }[]): Promise<void> {
    const slipUpdatePromises = debts.map(({ slipId, supplier }) => 
        runTransaction(db, async (transaction) => {
            const slipRef = doc(db, 'expense_slips', slipId);
            const slipDoc = await transaction.get(slipRef);
            if (!slipDoc.exists()) return;

            const slip = slipDoc.data() as ExpenseSlip;
            const updatedItems = slip.items.map(item => {
                if (item.supplier === supplier || (supplier === 'other_cost' && item.itemId === 'other_cost')) {
                    return { ...item, isPaid: true };
                }
                return item;
            });

            const allItemsPaid = updatedItems.every(item => item.isPaid);
            transaction.update(slipRef, { 
                items: updatedItems,
                paymentStatus: allItemsPaid ? 'paid' : 'unpaid'
            });
        })
    );
    await Promise.all(slipUpdatePromises);
}

export async function undoSupplierDebtPayment(slipId: string, supplier: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const slipRef = doc(db, 'expense_slips', slipId);
        const slipDoc = await transaction.get(slipRef);
        if (!slipDoc.exists()) throw new Error("Không tìm thấy phiếu chi.");

        const slip = slipDoc.data() as ExpenseSlip;
        const updatedItems = slip.items.map(item => {
            if (item.supplier === supplier || (supplier === 'other_cost' && item.itemId === 'other_cost')) {
                const { isPaid, ...rest } = item;
                return rest;
            }
            return item;
        });

        transaction.update(slipRef, { 
            items: updatedItems,
            paymentStatus: 'unpaid'
        });
    });
}

export function subscribeToAllIncidents(callback: (incidents: IncidentReport[]) => void): () => void {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
        const incidents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as IncidentReport));
        callback(incidents);
    });
}

export async function deleteIncident(incident: IncidentReport): Promise<void> {
    const incidentRef = doc(db, 'incidents', incident.id);
    
    if (incident.photos && incident.photos.length > 0) {
        await Promise.all(incident.photos.map(url => deleteFileByUrl(url)));
    }

    await deleteDoc(incidentRef);
    
    if(incident.cost > 0) {
        const slipsQuery = query(collection(db, "expense_slips"), where("associatedIncidentId", "==", incident.id));
        const slipsSnapshot = await getDocs(slipsQuery);
        if (!slipsSnapshot.empty) {
            const slipDoc = slipsSnapshot.docs[0];
            await deleteDoc(doc(db, 'expense_slips', slipDoc.id));
        }
    }
}

export function subscribeToAllRevenueStats(callback: (stats: RevenueStats[]) => void): () => void {
    const q = query(collection(db, 'revenue_stats'), orderBy('date', 'desc'));
    return onSnapshot(q, snapshot => {
        const stats = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...doc.data(),
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as RevenueStats
        });
        callback(stats);
    });
}

export async function addCashHandoverReport(
    data: Omit<CashHandoverReport, 'id' | 'createdAt' | 'createdBy' | 'date' | 'discrepancyProofPhotos'> & { newPhotoIds?: string[] },
    user: AuthUser
  ): Promise<void> {
    const { newPhotoIds = [], ...reportData } = data;
    const reportDate = (reportData as CashHandoverReport).date || format(new Date(), 'yyyy-MM-dd');

    const uploadPromises = newPhotoIds.map(async (photoId) => {
      const photoBlob = await photoStore.getPhoto(photoId);
      if (!photoBlob) return null;
      const storagePath = `cash-handover-reports/${reportDate}/${uuidv4()}.jpg`;
      return uploadFile(photoBlob, storagePath);
    });
    const newPhotoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);

    const finalData: Omit<CashHandoverReport, 'id'> = {
      ...reportData,
      date: reportDate,
      createdBy: { userId: user.uid, userName: user.displayName || 'N/A' },
      createdAt: serverTimestamp(),
      discrepancyProofPhotos: newPhotoUrls,
    };

    await addDoc(collection(db, 'cash_handover_reports'), finalData);

    await photoStore.deletePhotos(newPhotoIds);
}

export async function updateCashHandoverReport(
    reportId: string,
    data: Partial<Omit<CashHandoverReport, 'id' | 'createdAt' | 'createdBy' | 'date' >> & { newPhotoIds?: string[], photosToDelete?: string[] },
    user: AuthUser
  ): Promise<void> {
    const { newPhotoIds = [], photosToDelete = [], ...reportData } = data;
    const docRef = doc(db, 'cash_handover_reports', reportId);

    const currentDoc = await getDoc(docRef);
    if (!currentDoc.exists()) {
      throw new Error("Cash handover report not found to update.");
    }
    const reportDate = currentDoc.data().date;

    const uploadPromises = newPhotoIds.map(async (photoId) => {
      const photoBlob = await photoStore.getPhoto(photoId);
      if (!photoBlob) return null;
      const storagePath = `cash-handover-reports/${reportDate}/${uuidv4()}.jpg`;
      return uploadFile(photoBlob, storagePath);
    });
    const newPhotoUrls = (await Promise.all(uploadPromises)).filter((url): url is string => !!url);

    if (photosToDelete.length > 0) {
      await Promise.all(photosToDelete.map(url => deleteFileByUrl(url)));
    }

    const existingPhotos = currentDoc.data().discrepancyProofPhotos || [];
    const remainingPhotos = existingPhotos.filter((p: string) => !photosToDelete.includes(p));
    const finalPhotos = [...remainingPhotos, ...newPhotoUrls];

    await updateDoc(docRef, { ...reportData, date: reportDate, discrepancyProofPhotos: finalPhotos });

    await photoStore.deletePhotos(newPhotoIds);
}

export async function deleteCashHandoverReport(reportId: string, user: AuthUser): Promise<void> {
    if (user.role !== 'Chủ nhà hàng') {
      throw new Error("Bạn không có quyền thực hiện hành động này.");
    }

    const docRef = doc(db, 'cash_handover_reports', reportId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const reportData = docSnap.data() as CashHandoverReport;

      if (reportData.discrepancyProofPhotos && reportData.discrepancyProofPhotos.length > 0) {
        const photoDeletionPromises = reportData.discrepancyProofPhotos.map(url =>
          deleteFileByUrl(url)
        );
        await Promise.all(photoDeletionPromises);
      }
    }

    await deleteDoc(docRef);
}
