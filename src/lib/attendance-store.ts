'use client';

import { db, storage } from './firebase';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
  addDoc,
  limit,
  writeBatch,
  orderBy,
  arrayUnion,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ref } from 'firebase/storage';
import type { AssignedShift, AttendanceRecord, AuthUser, Schedule } from './types';
import { getISOWeek, startOfMonth, endOfMonth, format, startOfToday, endOfToday, differenceInMinutes } from 'date-fns';
import { getActiveShifts } from './schedule-utils';
import { photoStore } from './photo-store';
import { getSchedule } from './schedule-store';
import { uploadFile } from './data-store-helpers';

import { differenceInHours } from 'date-fns';
import { withCoalescedInvoke } from 'next/dist/lib/coalesced-function';
export async function getActiveShiftForUser(userId: string): Promise<AssignedShift | null> {
    const today = new Date();
    const weekId = `${today.getFullYear()}-W${getISOWeek(today)}`;
    const schedule = await getSchedule(weekId);
    if (!schedule || schedule.status !== 'published') {
        return null;
    }
    const todayKey = format(today, 'yyyy-MM-dd');
    const assignedShiftsToday = schedule.shifts.filter(
        shift => shift.date === todayKey && shift.assignedUsers.some(u => u.userId === userId)
    );
    const activeShifts = getActiveShifts(assignedShiftsToday);
    return activeShifts[0] || null; // Return the first active shift if any
}

export function subscribeToLatestInProgressAttendanceRecord(userId: string, callback: (record: AttendanceRecord | null) => void): () => void {
    const attendanceCollection = collection(db, 'attendance_records');
    const q = query(
        attendanceCollection,
        where('userId', '==', userId),
        orderBy('checkInTime', 'desc'),
        limit(1)
    );
    
    return onSnapshot(q, (snapshot) => {
        // This will find the most recent record for the user. We then check if
        // it is 'in-progress' on the client. This avoids needing a composite index.
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const record = { id: doc.id, ...doc.data() } as AttendanceRecord;
            if (record.status === 'in-progress') {
                callback(record);
            } else {
                callback(null);
            }
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read attendance record: ${error}`);
        callback(null);
    });
}

export function subscribeToLatestUserRecordForToday(userId: string, callback: (record: AttendanceRecord | null) => void): () => void {
    const attendanceCollection = collection(db, 'attendance_records');
    const todayStart = startOfToday();

    // This query finds the most recent record for the user today that is either 'in-progress' or 'pending_late'.
    // This is more robust than just looking for 'in-progress'.
    const q = query(
        attendanceCollection,
        where('userId', '==', userId),
        where('createdAt', '>=', todayStart),
        orderBy('createdAt', 'desc'),
        limit(1)
    );

    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            callback({ id: doc.id, ...doc.data() } as AttendanceRecord);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read latest user record: ${error}`);
        callback(null);
    });
}

export async function requestLateCheckIn(user: AuthUser, reason: string, minutes: number, photoId?: string): Promise<void> {
    const attendanceCollection = collection(db, 'attendance_records');
    const todayStart = startOfToday();

    // Check for existing pending or in-progress records for today
    const q = query(
        attendanceCollection,
        where('userId', '==', user.uid),
        where('createdAt', '>=', todayStart),
        where('status', 'in', ['in-progress', 'pending_late'])
    );
    const existingRecords = await getDocs(q);
    if (!existingRecords.empty) {
        throw new Error("Bạn đã có một yêu cầu đi trễ hoặc đã chấm công trong ngày hôm nay.");
    }

    let photoUrl: string | undefined = undefined;
    if (photoId) {
        const photoBlob = await photoStore.getPhoto(photoId);
        if (!photoBlob) throw new Error("Local photo not found for late reason.");
        const storagePath = `attendance/${format(new Date(), 'yyyy-MM-dd')}/${user.uid}/${uuidv4()}-late-reason.jpg`;
        photoUrl = await uploadFile(photoBlob, storagePath);
    }

    const newRecord: Omit<AttendanceRecord, 'id'> = {
        userId: user.uid,
        status: 'pending_late',
        lateReason: reason,
        estimatedLateMinutes: minutes,
        ...(photoUrl && { lateReasonPhotoUrl: photoUrl }),
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };

    await addDoc(attendanceCollection, newRecord);
    if (photoId) await photoStore.deletePhoto(photoId);
}

export async function createAttendanceRecord(user: AuthUser, photoId: string, isOffShift: boolean = false, offShiftReason?: string): Promise<void> {
    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) throw new Error("Local photo not found for check-in.");

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const hourlyRate = userDoc.exists() ? (userDoc.data().hourlyRate || 0) : 0;

    const storagePath = `attendance/${format(new Date(), 'yyyy-MM-dd')}/${user.uid}/${uuidv4()}-in.jpg`;
    const photoUrl = await uploadFile(photoBlob, storagePath);

    const attendanceCollection = collection(db, 'attendance_records');
    const todayStart = startOfToday();

    // Look for a 'pending_late' record for today
    const q = query(
        attendanceCollection,
        where('userId', '==', user.uid),
        where('status', '==', 'pending_late'),
        orderBy('createdAt', 'desc')
    );

    const pendingRecords = await getDocs(q);

    let recordToUpdate = null;

    if (!pendingRecords.empty) {
        //Check if any pendingRecords is not from today, then remove them from server
        const recordsToDelete = pendingRecords.docs.filter(pendingDoc => {
            const pendingData = pendingDoc.data();
            return pendingData.createdAt && (pendingData.createdAt as Timestamp).toDate() < todayStart;
        });

        for (const docToDelete of recordsToDelete) {
            await deleteDoc(docToDelete.ref);
        }

        const pendingDoc = pendingRecords.docs[0];
        const pendingData = pendingDoc.data();
        // Ensure the pending record is from today
        if (pendingData.createdAt && (pendingData.createdAt as Timestamp).toDate() >= todayStart) {
            recordToUpdate = pendingDoc.ref;
        }
    }

    if (recordToUpdate) {
        // Update the existing 'pending_late' record
        await updateDoc(recordToUpdate, {
            checkInTime: serverTimestamp(),
            photoInUrl: photoUrl,
            status: 'in-progress',
            hourlyRate: hourlyRate,
            updatedAt: serverTimestamp()
        });
    } else {
        // Create a new record
        const newRecord: Omit<AttendanceRecord, 'id'> = {
            userId: user.uid,
            checkInTime: serverTimestamp() as Timestamp,
            photoInUrl: photoUrl,
            status: 'in-progress',
            hourlyRate: hourlyRate,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            ...(isOffShift && { isOffShift: true }),
            ...(isOffShift && offShiftReason && { offShiftReason: offShiftReason }),
        };
        await addDoc(attendanceCollection, newRecord);
    }

    await photoStore.deletePhoto(photoId);
}

export async function updateAttendanceRecord(recordId: string, photoId: string): Promise<void> {
    const recordRef = doc(db, 'attendance_records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) throw new Error("Attendance record not found.");
    const recordData = recordSnap.data();

    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) throw new Error("Local photo not found for check-out.");

    const storagePath = `attendance/${format(new Date(), 'yyyy-MM-dd')}/${recordData.userId}/${uuidv4()}-out.jpg`;
    const photoUrl = await uploadFile(photoBlob, storagePath);

    const checkInTime = recordData.checkInTime.toDate();
    const checkOutTime = new Date(); // Use new Date() for consistency
    
    const totalHours = differenceInMinutes(checkOutTime, checkInTime) / 60;

    // Fetch user data to get hourly rate
    const userDoc = await getDoc(doc(db, 'users', recordData.userId));
    const currentUserHourlyRate = userDoc.exists() ? userDoc.data().hourlyRate : 0;
    // Use the hourlyRate snapshotted on the record for calculation.
    const hourlyRate = recordData.hourlyRate ?? currentUserHourlyRate ?? 0;
    const salary = totalHours * hourlyRate;

    await updateDoc(recordRef, {
        checkOutTime: checkOutTime,
        totalHours: totalHours,
        salary: salary,
        photoOutUrl: photoUrl,
        status: 'completed',
        updatedAt: serverTimestamp(),
    });
    await photoStore.deletePhoto(photoId);
}

export async function startBreak(recordId: string, photoId: string): Promise<void> {
    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) throw new Error("Local photo not found for starting break.");

    const storagePath = `attendance/${format(new Date(), 'yyyy-MM-dd')}/${recordId}/${uuidv4()}-break-start.jpg`;
    const photoUrl = await uploadFile(photoBlob, storagePath);

    const newBreak = {
        breakStartTime: Timestamp.now(),
        breakStartPhotoUrl: photoUrl,
    };

    const recordRef = doc(db, 'attendance_records', recordId);
    await updateDoc(recordRef, {
        onBreak: true,
        breaks: arrayUnion(newBreak)
    });
    await photoStore.deletePhoto(photoId);
}

export async function endBreak(recordId: string, photoId: string): Promise<void> {
    const recordRef = doc(db, 'attendance_records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) throw new Error("Attendance record not found.");

    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) throw new Error("Local photo not found for ending break.");

    const storagePath = `attendance/${format(new Date(), 'yyyy-MM-dd')}/${recordId}/${uuidv4()}-break-end.jpg`;
    const photoUrl = await uploadFile(photoBlob, storagePath);

    const recordData = recordSnap.data();
    const breaks = recordData.breaks || [];
    
    if (breaks.length > 0) {
        const lastBreak = breaks[breaks.length - 1];
        lastBreak.breakEndTime = Timestamp.now();
        lastBreak.breakEndPhotoUrl = photoUrl;
    }

    await updateDoc(recordRef, {
        onBreak: false,
        breaks: breaks, // Overwrite the entire array with the modified one
    });
    await photoStore.deletePhoto(photoId);
}

export async function createManualAttendanceRecord(
    data: { userId: string; checkInTime: Date; checkOutTime: Date },
    creator: AuthUser
): Promise<void> {
    const totalHours = differenceInMinutes(data.checkOutTime, data.checkInTime) / 60;

    const userDoc = await getDoc(doc(db, 'users', data.userId));
    const hourlyRate = userDoc.exists() ? (userDoc.data().hourlyRate || 0) : 0;
    const salary = totalHours * hourlyRate;

    const newRecord: Omit<AttendanceRecord, 'id'> = {
        userId: data.userId,
        checkInTime: Timestamp.fromDate(data.checkInTime),
        checkOutTime: Timestamp.fromDate(data.checkOutTime),
        photoInUrl: '', // No photo for manual entry
        photoOutUrl: '', // No photo for manual entry
        status: 'completed',
        totalHours: totalHours,
        hourlyRate: hourlyRate,
        salary: salary,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };

    await addDoc(collection(db, 'attendance_records'), newRecord);
}

export async function updateAttendanceRecordDetails(recordId: string, data: { checkInTime: Date, checkOutTime?: Date, hourlyRate?: number }): Promise<void> {
    const recordRef = doc(db, 'attendance_records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) throw new Error("Attendance record not found.");

    const totalHours = data.checkOutTime ? differenceInMinutes(data.checkOutTime, data.checkInTime)/60 : 0;
    const status = data.checkOutTime ? 'completed' : 'in-progress';
    
    // Prioritize the rate from the edit form, then the one on the record, then fallback to current user rate
    const hourlyRate = data.hourlyRate ?? recordSnap.data().hourlyRate ?? 0;
    const salary = totalHours * hourlyRate;

    await updateDoc(recordRef, {
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime || null,
        totalHours: totalHours,
        salary: salary,
        status: status,
        hourlyRate: hourlyRate,
        updatedAt: serverTimestamp(),
    });
}

export async function updateAttendanceRecordRate(recordId: string, newRate: number): Promise<void> {
    const recordRef = doc(db, 'attendance_records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) throw new Error("Attendance record not found.");

    const recordData = recordSnap.data();
    const totalHours = recordData.totalHours || 0;
    const newSalary = totalHours * newRate;

    await updateDoc(recordRef, {
        hourlyRate: newRate,
        salary: newSalary,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteAttendanceRecord(recordId: string): Promise<void> {
    await deleteDoc(doc(db, 'attendance_records', recordId));
}

export function subscribeToAllAttendanceRecordsForMonth(date: Date, callback: (records: AttendanceRecord[]) => void): () => void {
    const q = query(collection(db, 'attendance_records'), where('checkInTime', '>=', startOfMonth(date)), where('checkInTime', '<=', endOfMonth(date)), orderBy('checkInTime', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        callback(records);
    });
}

export function subscribeToUserAttendanceForToday(userId: string, callback: (records: AttendanceRecord[]) => void): () => void {
    const attendanceCollection = collection(db, 'attendance_records');
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const q = query(
        attendanceCollection,
        where('userId', '==', userId),
        where('createdAt', '>=', todayStart),
        where('createdAt', '<=', todayEnd),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        callback(records);
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read today's attendance records: ${error}`);
        callback([]);
    });
}

export function subscribeToUserCheckInStatus(userId: string, callback: (isCheckedIn: boolean) => void): () => void {
    const attendanceCollection = collection(db, 'attendance_records');
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const q = query(
        attendanceCollection,
        where('userId', '==', userId),
        where('status', '==', 'in-progress'),
        where('checkInTime', '>=', todayStart),
        where('checkInTime', '<=', todayEnd),
        limit(1)
    );

    return onSnapshot(q, (snapshot) => {
        callback(!snapshot.empty);
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read user check-in status: ${error}`);
        callback(false);
    });
}


export async function resolveUnfinishedAttendances(): Promise<number> {
    const q = query(collection(db, 'attendance_records'), where('status', '==', 'in-progress'), where('checkInTime', '<', startOfToday()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'auto-completed', updatedAt: serverTimestamp() });
    });
    await batch.commit();
    return snapshot.size;
}
