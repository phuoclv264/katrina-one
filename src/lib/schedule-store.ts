

'use client';

import { db } from './firebase';
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
  writeBatch,
  runTransaction,
  or,
  and,
  arrayUnion,
} from 'firebase/firestore';
import type { Schedule, AssignedShift, Availability, ManagedUser, ShiftTemplate, Notification, UserRole, AssignedUser, AuthUser, PassRequestPayload, TimeSlot } from './types';
import { getISOWeek, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, getDay, parseISO, isPast, isWithinInterval } from 'date-fns';
import { hasTimeConflict } from './schedule-utils';


// --- Schedule Functions ---

export async function getSchedule(weekId: string): Promise<Schedule | null> {
    const docRef = doc(db, 'schedules', weekId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as Schedule;
    }
    return null;
}

export function subscribeToSchedule(weekId: string, callback: (schedule: Schedule | null) => void): () => void {
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
                            if (current.start <= lastMerged.end) {
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
}

export function subscribeToAllSchedules(callback: (schedules: Schedule[]) => void): () => void {
    const q = query(collection(db, 'schedules'), orderBy('weekId', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const schedules = snapshot.docs.map(doc => ({...doc.data(), weekId: doc.id} as Schedule));
        callback(schedules);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read all schedules: ${error.code}`);
        callback([]);
    });
}

export async function getSchedulesForMonth(date: Date): Promise<Schedule[]> {
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
}

export async function updateSchedule(weekId: string, data: Partial<Schedule>): Promise<void> {
    const docRef = doc(db, 'schedules', weekId);
    
    const notificationsQuery = query(
        collection(db, 'notifications'),
        and(
            where('payload.weekId', '==', weekId),
            or(where('status', '==', 'pending'), where('status', '==', 'pending_approval'))
        )
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    const pendingNotifications = notificationsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Notification));
    const batch = writeBatch(db);

    pendingNotifications.forEach(notif => {
        const { payload } = notif;
        const shiftInNewSchedule = data.shifts?.find(s => s.id === payload.shiftId);

        if (!shiftInNewSchedule || !shiftInNewSchedule.assignedUsers.some(u => u.userId === payload.requestingUser.userId)) {
            batch.update(doc(db, 'notifications', notif.id), { status: 'cancelled', 'payload.cancellationReason': 'Tự động hủy do người yêu cầu không còn trong ca.' });
            return;
        }
        
        if (notif.status === 'pending_approval' && payload.takenBy) {
            const taker = payload.takenBy;
            const shiftsOnDay = data.shifts?.filter(s => s.date === payload.shiftDate) || [];
            const conflict = hasTimeConflict(taker.userId, shiftInNewSchedule, shiftsOnDay.filter(s => s.id !== payload.shiftId));
            
            if (conflict) {
                 batch.update(doc(db, 'notifications', notif.id), { 
                    status: 'pending', 
                    'payload.takenBy': null, 
                    'payload.declinedBy': arrayUnion(taker.userId)
                });
                return;
            }
        }

        if (payload.isSwapRequest && payload.targetUserShiftPayload) {
             const targetShiftInNewSchedule = data.shifts?.find(s => s.id === payload.targetUserShiftPayload?.shiftId);
             const targetUserId = payload.targetUserId || payload.takenBy?.userId;

             if (!targetShiftInNewSchedule || !targetShiftInNewSchedule.assignedUsers.some(u => u.userId === targetUserId)) {
                 batch.update(doc(db, 'notifications', notif.id), { status: 'cancelled', 'payload.cancellationReason': 'Tự động hủy do người được đổi không còn trong ca.' });
             }
        }
    });

    await batch.commit();
    await setDoc(docRef, data, { merge: true });
}

export async function createDraftScheduleForNextWeek(currentDate: Date, shiftTemplates: ShiftTemplate[]): Promise<void> {
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
}

export function subscribeToShiftTemplates(callback: (templates: ShiftTemplate[]) => void): () => void {
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
}

export async function updateShiftTemplates(templates: ShiftTemplate[]): Promise<void> {
    const docRef = doc(db, 'app-data', 'shiftTemplates');
    await setDoc(docRef, { templates });
}

export async function requestPassShift(shiftToPass: AssignedShift, requestingUser: { uid: string, displayName: string }): Promise<Notification | null> {
    const existingRequestQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'pass_request'),
        where('payload.shiftId', '==', shiftToPass.id),
        where('payload.requestingUser.userId', '==', requestingUser.uid),
        where('status', 'in', ['pending', 'pending_approval'])
    );

    const existingRequestsSnapshot = await getDocs(existingRequestQuery);
    if (!existingRequestsSnapshot.empty) {
        const existingRequestData = existingRequestsSnapshot.docs[0].data() as Notification;
        existingRequestData.id = existingRequestsSnapshot.docs[0].id;
        return existingRequestData;
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
            isSwapRequest: false,
            declinedBy: [],
        }
    };
    await addDoc(collection(db, "notifications"), newNotification);
    return null;
}

export async function requestDirectPassShift(shiftToPass: AssignedShift, requestingUser: AuthUser, targetUser: ManagedUser, isSwap: boolean, targetUserShift: AssignedShift | null): Promise<Notification | null> {
    const existingRequestQuery = query(
        collection(db, 'notifications'),
        where('type', '==', 'pass_request'),
        where('payload.shiftId', '==', shiftToPass.id),
        where('payload.requestingUser.userId', '==', requestingUser.uid),
        where('status', 'in', ['pending', 'pending_approval'])
    );
    const existingRequestsSnapshot = await getDocs(existingRequestQuery);
    if (!existingRequestsSnapshot.empty) {
        const existingRequestData = existingRequestsSnapshot.docs[0].data() as Notification;
        existingRequestData.id = existingRequestsSnapshot.docs[0].id;
        return existingRequestData;
    }

    if (isSwap && !targetUserShift) {
        throw new Error(`${targetUser.displayName} không có ca làm việc trong ngày này để đổi.`);
    }

    if (isSwap && targetUserShift) {
         const targetShiftRequestQuery = query(
            collection(db, 'notifications'),
            where('type', '==', 'pass_request'),
            where('payload.shiftId', '==', targetUserShift.id),
            where('status', 'in', ['pending', 'pending_approval'])
        );
        const targetShiftSnapshot = await getDocs(targetShiftRequestQuery);
        if (!targetShiftSnapshot.empty) {
            throw new Error(`Không thể đổi ca vì ca làm việc của ${targetUser.displayName} đã có một yêu cầu pass ca khác đang chờ xử lý.`);
        }
    }

    const weekId = `${new Date(shiftToPass.date).getFullYear()}-W${getISOWeek(new Date(shiftToPass.date))}`;
    const payload: PassRequestPayload = {
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
        targetUserId: targetUser.uid,
        isSwapRequest: isSwap,
        declinedBy: [],
    };

    if (isSwap && targetUserShift) {
        payload.targetUserShiftPayload = {
            shiftId: targetUserShift.id,
            shiftLabel: targetUserShift.label,
            shiftTimeSlot: targetUserShift.timeSlot,
            date: targetUserShift.date,
        };
    }

    const newNotification: Omit<Notification, 'id'> = {
        type: 'pass_request',
        status: 'pending',
        createdAt: serverTimestamp(),
        payload: payload
    };
    await addDoc(collection(db, "notifications"), newNotification);
    return null;
}

export async function revertPassRequest(notification: Notification, resolver: AuthUser): Promise<void> {
    const { payload } = notification;
    const scheduleRef = doc(db, "schedules", payload.weekId);

    await runTransaction(db, async (transaction) => {
        const scheduleDoc = await transaction.get(scheduleRef);
        if (!scheduleDoc.exists()) throw new Error("Không tìm thấy lịch làm việc.");

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

        const notificationRef = doc(db, "notifications", notification.id);
        transaction.update(notificationRef, {
            status: 'pending',
            resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
            resolvedAt: serverTimestamp(),
            'payload.takenBy': null,
             cancellationReason: null, // Clear cancellation reason
        });
    });
}

export async function acceptPassShift(notificationId: string, payload: PassRequestPayload, acceptingUser: AssignedUser, schedule: Schedule): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);

    const shift = schedule.shifts.find(s => s.id === payload.shiftId);
    if (!shift || !shift.assignedUsers.some(u => u.userId === payload.requestingUser.userId)) {
        await updateDoc(notificationRef, {
            status: 'cancelled',
            'payload.cancellationReason': 'Người yêu cầu không còn trong ca.',
            resolvedAt: serverTimestamp(),
        });
        throw new Error("Yêu cầu này không còn hợp lệ vì người pass ca đã không còn trong ca làm việc.");
    }

    if (!payload.isSwapRequest) {
        const allShiftsOnDay = schedule.shifts.filter(s => s.date === payload.shiftDate);
        const shiftToTake: AssignedShift = { ...schedule.shifts.find(s => s.id === payload.shiftId)!, assignedUsers: [] };
        
        const conflict = hasTimeConflict(acceptingUser.userId, shiftToTake, allShiftsOnDay);
        if (conflict) {
            throw new Error(`Ca này bị trùng giờ với ca "${conflict.label}" (${conflict.timeSlot.start} - ${conflict.timeSlot.end}) mà bạn đã được phân công.`);
        }
    }
    
    await updateDoc(notificationRef, {
        status: 'pending_approval',
        'payload.takenBy': acceptingUser
    });
}

export async function declinePassShift(notification: Notification, decliningUser: { uid: string, displayName: string }): Promise<void> {
    const notificationRef = doc(db, "notifications", notification.id);

    if (notification.payload.targetUserId === decliningUser.uid) {
        // It's a direct request, so declining means cancelling it.
        await updateDoc(notificationRef, {
            status: 'cancelled',
            'payload.cancellationReason': `Bị từ chối bởi ${decliningUser.displayName}`,
            resolvedBy: { userId: decliningUser.uid, userName: decliningUser.displayName },
            resolvedAt: serverTimestamp(),
        });
    } else {
        // It's a public request, just add to the declined list.
        await runTransaction(db, async (transaction) => {
            const notificationDoc = await transaction.get(notificationRef);
            if (!notificationDoc.exists()) throw new Error("Notification not found");
            const existingDeclined = notificationDoc.data().payload.declinedBy || [];
            const newDeclined = Array.from(new Set([...existingDeclined, decliningUser.uid]));
            transaction.update(notificationRef, { 'payload.declinedBy': newDeclined });
        });
    }
}

export async function approvePassRequest(notification: Notification, resolver: AuthUser): Promise<void> {
    const { payload } = notification;
    const { weekId, shiftId, requestingUser, takenBy, isSwapRequest } = payload;
    const scheduleRef = doc(db, "schedules", weekId);
    const notificationRef = doc(db, "notifications", notification.id);

    if (!takenBy) {
        throw new Error("Không có người nhận ca để phê duyệt.");
    }

    await runTransaction(db, async (transaction) => {
        const scheduleDoc = await transaction.get(scheduleRef);
        if (!scheduleDoc.exists()) throw new Error("Không tìm thấy lịch làm việc.");
        
        const scheduleData = scheduleDoc.data() as Schedule;
        let updatedShifts = [...scheduleData.shifts];

        const shiftA_Index = updatedShifts.findIndex(s => s.id === shiftId);
         if (shiftA_Index === -1 || !updatedShifts[shiftA_Index].assignedUsers.some(u => u.userId === requestingUser.userId)) {
            transaction.update(notificationRef, { status: 'cancelled', 'payload.cancellationReason': 'Người yêu cầu không còn trong ca.' });
            throw new Error("Không thể phê duyệt: Người yêu cầu ban đầu không còn trong ca làm việc này.");
        }

        if (isSwapRequest) {
            if (!payload.targetUserShiftPayload) {
                 throw new Error("Lỗi dữ liệu: Thiếu thông tin ca cần đổi.");
            }
            const shiftB_Index = updatedShifts.findIndex(s => s.id === payload.targetUserShiftPayload!.shiftId);

            if (shiftB_Index === -1 || !updatedShifts[shiftB_Index].assignedUsers.some(u => u.userId === takenBy.userId)) {
                transaction.update(notificationRef, { status: 'cancelled', 'payload.cancellationReason': 'Người nhận không còn trong ca cần đổi.' });
                throw new Error("Không thể phê duyệt: Người nhận không còn trong ca làm việc cần đổi.");
            }

            const shiftA = { ...updatedShifts[shiftA_Index] };
            const shiftB = { ...updatedShifts[shiftB_Index] };
            
            shiftA.assignedUsers = shiftA.assignedUsers.filter(u => u.userId !== requestingUser.userId);
            shiftA.assignedUsers.push(takenBy);

            shiftB.assignedUsers = shiftB.assignedUsers.filter(u => u.userId !== takenBy.userId);
            shiftB.assignedUsers.push(requestingUser);
            
            updatedShifts[shiftA_Index] = shiftA;
            updatedShifts[shiftB_Index] = shiftB;

        } else {
            const shiftA = { ...updatedShifts[shiftA_Index] };
            const conflict = hasTimeConflict(takenBy.userId, shiftA, updatedShifts.filter(s => s.date === shiftA.date));
            if (conflict) {
                transaction.update(notificationRef, { status: 'cancelled', 'payload.cancellationReason': `Tự động hủy do người nhận ca (${takenBy.userName}) bị trùng lịch.`, 'payload.takenBy': null });
                throw new Error(`SHIFT_CONFLICT: Nhân viên ${takenBy.userName} đã có ca làm việc khác (${conflict.label}) bị trùng giờ.`);
            }
            
            shiftA.assignedUsers = shiftA.assignedUsers.filter(u => u.userId !== requestingUser.userId);
            shiftA.assignedUsers.push(takenBy);
            updatedShifts[shiftA_Index] = shiftA;
        }

        transaction.update(scheduleRef, { shifts: updatedShifts });
        transaction.update(notificationRef, { status: 'resolved', resolvedBy: { userId: resolver.uid, userName: resolver.displayName }, resolvedAt: serverTimestamp() });
        
        const otherRequestsQuery = query(collection(db, 'notifications'), and(where('type', '==', 'pass_request'), where('payload.shiftId', '==', shiftId), or(where('status', '==', 'pending'), where('status', '==', 'pending_approval'))));
        const otherRequestsSnapshot = await getDocs(otherRequestsQuery);
        otherRequestsSnapshot.forEach(doc => {
            if (doc.id !== notification.id) {
                transaction.update(doc.ref, { status: 'cancelled', 'payload.cancellationReason': 'Đã có người khác nhận và được phê duyệt.', resolvedBy: { userId: resolver.uid, userName: resolver.displayName }, resolvedAt: serverTimestamp() });
            }
        });
    });
}

export async function rejectPassRequestApproval(notificationId: string, resolver: AuthUser): Promise<void> {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
        status: 'pending',
        resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
        resolvedAt: serverTimestamp(),
        'payload.takenBy': null
    });
}

export async function resolvePassRequestByAssignment(notification: Notification, assignedUser: AssignedUser, resolver: AuthUser): Promise<void> {
    const scheduleRef = doc(db, "schedules", notification.payload.weekId);
    const notificationRef = doc(db, "notifications", notification.id);

    await runTransaction(db, async (transaction) => {
        const scheduleDoc = await transaction.get(scheduleRef);
        if (!scheduleDoc.exists()) {
            throw new Error("Không tìm thấy lịch làm việc.");
        }

        const scheduleData = scheduleDoc.data() as Schedule;
        const updatedShifts = scheduleData.shifts.map(s => {
            if (s.id === notification.payload.shiftId) {
                const newAssignedUsers = s.assignedUsers.filter(u => u.userId !== notification.payload.requestingUser.userId);
                if (!newAssignedUsers.some(u => u.userId === assignedUser.userId)) {
                    newAssignedUsers.push(assignedUser);
                }
                return { ...s, assignedUsers: newAssignedUsers };
            }
            return s;
        });
        transaction.update(scheduleRef, { shifts: updatedShifts });

        transaction.update(notificationRef, {
            status: 'resolved',
            'payload.takenBy': assignedUser,
            resolvedBy: { userId: resolver.uid, userName: resolver.displayName },
            resolvedAt: serverTimestamp(),
        });
    });
}

// --- Notifications ---
export function subscribeToRelevantNotifications(userId: string, userRole: UserRole, callback: (notifications: Notification[]) => void): () => void {
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
            where('type', '==', 'pass_request'),
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
                    const docRef = doc(db, 'notifications', n.id);
                    updateDoc(docRef, {
                        status: 'cancelled',
                        'payload.cancellationReason': 'Tự động hủy do đã quá hạn.',
                        resolvedAt: serverTimestamp(),
                    }).catch(e => console.error("Failed to auto-cancel own expired request:", e));
                    return;
                }
            }
            combined.set(n.id, n);
        });

        otherRequests.forEach(n => {
            const payload = n.payload;
            if (n.type === 'pass_request' && n.status === 'pending') {
                const shiftDateTime = parseISO(`${payload.shiftDate}T${payload.shiftTimeSlot.start}`);
                if (isPast(shiftDateTime)) {
                    return;
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
}

export function subscribeToAllNotifications(callback: (notifications: Notification[]) => void): () => void {
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
}

export async function updateNotificationStatus(notificationId: string, status: Notification['status'], resolver?: AuthUser): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    const updateData: any = { status, resolvedAt: serverTimestamp() };
    if (resolver) {
        updateData.resolvedBy = { userId: resolver.uid, userName: resolver.displayName };
    }
    if (status === 'cancelled') {
        updateData['payload.cancellationReason'] = 'Hủy bởi quản lý';
    }
    await updateDoc(docRef, updateData);
}

export async function deleteNotification(notificationId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
}
