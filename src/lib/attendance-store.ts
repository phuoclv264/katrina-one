'use client';

import { db, storage } from './firebase';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
  addDoc,
  limit,
  writeBatch,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { AssignedShift, AttendanceRecord, AuthUser, Schedule } from './types';
import { getISOWeek, startOfMonth, endOfMonth, format, startOfToday } from 'date-fns';
import { getActiveShifts } from './schedule-utils';
import { photoStore } from './photo-store';
import { getSchedule } from './schedule-store';
import { uploadFile } from './data-store-helpers';

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

export function subscribeToAttendanceRecord(userId: string, shiftId: string, callback: (record: AttendanceRecord | null) => void): () => void {
    const attendanceCollection = collection(db, 'attendance_records');
    const q = query(attendanceCollection, where('userId', '==', userId), where('shiftId', '==', shiftId), limit(1));
    
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            callback({ id: doc.id, ...doc.data() } as AttendanceRecord);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`[Firestore Read Error] Could not read attendance record: ${error.code}`);
        callback(null);
    });
}

export async function createAttendanceRecord(user: AuthUser, shift: AssignedShift, photoId: string): Promise<void> {
    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) throw new Error("Local photo not found for check-in.");

    const storagePath = `attendance/${shift.date}/${user.uid}/${shift.id}-in.jpg`;
    const photoUrl = await uploadFile(photoBlob, storagePath);

    const newRecord: Omit<AttendanceRecord, 'id'> = {
        userId: user.uid,
        shiftId: shift.id,
        checkInTime: serverTimestamp() as Timestamp,
        photoInUrl: photoUrl,
        status: 'in-progress',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };

    await addDoc(collection(db, 'attendance_records'), newRecord);
    await photoStore.deletePhoto(photoId);
}

export async function updateAttendanceRecord(recordId: string, photoId: string): Promise<void> {
    const recordRef = doc(db, 'attendance_records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) throw new Error("Attendance record not found.");
    const recordData = recordSnap.data();

    const photoBlob = await photoStore.getPhoto(photoId);
    if (!photoBlob) throw new Error("Local photo not found for check-out.");

    const storagePath = `attendance/${recordData.date}/${recordData.userId}/${recordData.shiftId}-out.jpg`;
    const photoUrl = await uploadFile(photoBlob, storagePath);

    await updateDoc(recordRef, {
        checkOutTime: serverTimestamp(),
        photoOutUrl: photoUrl,
        status: 'completed',
        updatedAt: serverTimestamp(),
    });
    await photoStore.deletePhoto(photoId);
}

export function subscribeToAllAttendanceRecordsForMonth(date: Date, callback: (records: AttendanceRecord[]) => void): () => void {
    const q = query(collection(db, 'attendance_records'), where('checkInTime', '>=', startOfMonth(date)), where('checkInTime', '<=', endOfMonth(date)), orderBy('checkInTime', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        callback(records);
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
