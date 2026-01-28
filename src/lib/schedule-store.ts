

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
    documentId,
    addDoc,
    deleteDoc,
    writeBatch,
    WriteBatch,
    collectionGroup,
    runTransaction,
    or,
    and,
    arrayUnion,
} from 'firebase/firestore';
import type { Schedule, AssignedShift, Availability, ManagedUser, ShiftTemplate, Notification, UserRole, AssignedUser, AuthUser, PassRequestPayload, TimeSlot, MonthlyTask, MonthlyTaskAssignment, MediaAttachment, MediaItem, TaskCompletionRecord, SimpleUser, ShiftBusyEvidence, BusyReportRequest } from './types';
import { getISOWeek, getISOWeekYear, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, getDay, parseISO, isPast, isWithinInterval, startOfMonth, endOfMonth, eachWeekOfInterval, getYear, getDate, getWeekOfMonth, addMonths } from 'date-fns';
import { hasTimeConflict } from './schedule-utils';
import { DateRange } from 'react-day-picker';
import { uploadMedia, deleteFileByUrl } from './data-store-helpers';

// --- Schedule Functions ---

export async function getSchedule(weekId: string): Promise<Schedule | null> {
    const docRef = doc(db, 'schedules', weekId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as Schedule;
    }
    return null;
}

// --- Availability Functions ---

export function subscribeToAvailabilityForWeek(weekId: string, callback: (availability: Availability[]) => void): () => void {
    const parts = weekId.split('-W');
    if (parts.length !== 2) {
        callback([]);
        return () => { };
    }
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);

    if (isNaN(year) || isNaN(week)) {
        callback([]);
        return () => { };
    }

    // Jan 4th is always in ISO week 1
    const jan4 = new Date(year, 0, 4);
    const weekStart = addDays(startOfWeek(jan4, { weekStartsOn: 1 }), (week - 1) * 7);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const q = query(
        collection(db, 'user_availability'),
        where('date', '>=', Timestamp.fromDate(weekStart)),
        where('date', '<=', Timestamp.fromDate(weekEnd))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const availabilityData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                // Convert Timestamp to string for client-side consistency
                date: format((data.date as Timestamp).toDate(), 'yyyy-MM-dd'),
            } as Availability;
        });
        callback(availabilityData);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read availability for ${weekId}: ${error.code}`);
        callback([]);
    });

    return unsubscribe;
}

export async function saveUserAvailability(userId: string, userName: string, date: Date, slots: TimeSlot[]): Promise<void> {
    const newAvailability: Availability = {
        userId,
        userName,
        date: Timestamp.fromDate(date),
        availableSlots: slots,
    };

    // To maintain one availability doc per user per day, we first query for an existing one.
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(collection(db, 'user_availability'),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay))
    );

    const querySnapshot = await getDocs(q);

    const docRef = querySnapshot.empty ? doc(collection(db, 'user_availability')) : querySnapshot.docs[0].ref;
    await setDoc(docRef, newAvailability);
}

export function subscribeToAvailabilityForDateRange(dateRange: DateRange, callback: (availability: Availability[]) => void): () => void {
    if (!dateRange.from || !dateRange.to) {
        callback([]);
        return () => { };
    }
    const q = query(collection(db, 'user_availability'), where('date', '>=', Timestamp.fromDate(dateRange.from)), where('date', '<=', Timestamp.fromDate(dateRange.to)));
    return onSnapshot(q, (snapshot) => {
        const availabilityData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                // Convert Timestamp to string for client-side consistency
                date: data.date as Timestamp,
            } as Availability;
        });
        callback(availabilityData);
    });
}

export function subscribeToSchedule(weekId: string, callback: (schedule: Schedule | null) => void): () => void {
    const docRef = doc(db, 'schedules', weekId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const scheduleData = docSnap.data() as Schedule;

            // Merge overlapping/adjacent availability slots upon loading

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

export function subscribeToShiftBusyEvidencesForWeek(
    weekId: string,
    callback: (entries: ShiftBusyEvidence[]) => void
): () => void {
    if (!weekId) {
        callback([]);
        return () => { };
    }

    const evidencesQuery = query(
        collection(db, 'shift_busy_evidences'),
        where('weekId', '==', weekId)
    );

    const unsubscribe = onSnapshot(evidencesQuery, (snapshot) => {
        const evidences = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ShiftBusyEvidence, 'id'>),
        }));
        callback(evidences);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read busy evidences for ${weekId}: ${error.code}`);
        callback([]);
    });

    return unsubscribe;
}

export function subscribeToBusyReportRequestsForWeek(
    weekId: string,
    callback: (requests: BusyReportRequest[]) => void
): () => void {
    if (!weekId) {
        callback([]);
        return () => {};
    }
    const q = query(collection(db, 'busy_report_requests'), where('weekId', '==', weekId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Omit<BusyReportRequest, 'id'>) }));
        callback(requests);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read busy report requests for ${weekId}: ${error.code}`);
        callback([]);
    });
    return unsubscribe;
}

export async function setBusyReportRecipients({
    weekId,
    shift,
    createdBy,
    targetMode,
    targetUserIds = [],
    targetRoles = [],
    active = true,
}: {
    weekId: string;
    shift: AssignedShift;
    createdBy: SimpleUser;
    targetMode: 'users' | 'roles' | 'all';
    targetUserIds?: string[];
    targetRoles?: UserRole[];
    active?: boolean;
}): Promise<void> {
    if (!weekId || !shift?.id) throw new Error('Thiếu thông tin tuần hoặc ca.');
    const docRef = doc(db, 'busy_report_requests', `${weekId}_${shift.id}`);
    const payload: Omit<BusyReportRequest, 'id'> = {
        weekId,
        shiftId: shift.id,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active,
        targetMode,
    };
    // Only include targetUserIds/targetRoles if they're actually used to avoid undefined in Firestore
    if (targetMode === 'users') {
        payload.targetUserIds = Array.from(new Set(targetUserIds));
    }
    if (targetMode === 'roles') {
        payload.targetRoles = Array.from(new Set(targetRoles));
    }
    await setDoc(docRef, payload);
}

export function subscribeToAllSchedules(callback: (schedules: Schedule[]) => void): () => void {
    const q = query(collection(db, 'schedules'), orderBy('weekId', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const schedules = snapshot.docs.map(doc => ({ ...doc.data(), weekId: doc.id } as Schedule));
        callback(schedules);
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read all schedules: ${error.code}`);
        callback([]);
    });

    return unsubscribe;
}

export async function getSchedulesForMonth(date: Date): Promise<Schedule[]> {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const weeks = eachWeekOfInterval({
        start: monthStart,
        end: monthEnd,
    }, { weekStartsOn: 1 });

    const weekIds = weeks.map(weekStart => `${getISOWeekYear(weekStart)}-W${getISOWeek(weekStart)}`);

    const schedulePromises = weekIds.map(weekId => getDoc(doc(db, 'schedules', weekId)));
    const scheduleDocs = await Promise.all(schedulePromises);

    return scheduleDocs
        .filter(docSnap => docSnap.exists())
        .map(docSnap => ({ ...docSnap.data(), weekId: docSnap.id } as Schedule));
}

export function subscribeToSchedulesForMonth(date: Date, callback: (schedules: Schedule[]) => void): () => void {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const weeks = eachWeekOfInterval({
        start: monthStart,
        end: monthEnd,
    }, { weekStartsOn: 1 });

    const weekIds = weeks.map(weekStart => `${getISOWeekYear(weekStart)}-W${getISOWeek(weekStart)}`);

    if (weekIds.length === 0) {
        callback([]);
        return () => { }; // Return a no-op unsubscribe function
    }

    const q = query(collection(db, 'schedules'), where('weekId', 'in', weekIds));
    return onSnapshot(q, (snapshot) => {
        const schedules = snapshot.docs.map(doc => ({ ...doc.data(), weekId: doc.id } as Schedule));
        callback(schedules);
    });
}

export async function getSchedulesForDateRange(
    dateRange: DateRange | undefined,
): Promise<Schedule[]> {
    if (!dateRange || !dateRange.from || !dateRange.to) {
        return [];
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

    if (weekIds.length === 0) return [];

    const q = query(collection(db, 'schedules'), where(documentId(), 'in', weekIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), weekId: doc.id } as Schedule));
}

export function subscribeToSchedulesForDateRange(
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
}

export async function updateSchedule(weekId: string, data: Partial<Schedule>): Promise<void> {
    const docRef = doc(db, 'schedules', weekId);

    // First, query for all pending or pending_approval requests within this week
    const notificationsQuery = query(
        collection(db, 'notifications'),
        and(
            where('type', '==', 'pass_request'),
            where('payload.weekId', '==', weekId),
            or(where('status', '==', 'pending'), where('status', '==', 'pending_approval'))
        )
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    const pendingNotifications = notificationsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));

    // Create a batch to update notifications that become invalid
    const batch = writeBatch(db);

    for (const notif of pendingNotifications) {
        const { payload } = notif;
        const shiftInNewSchedule = data.shifts?.find(s => s.id === payload.shiftId);

        // Case 1: The original requester is no longer in the shift. The request is invalid.
        if (!shiftInNewSchedule || !shiftInNewSchedule.assignedUsers.some(u => u.userId === payload.requestingUser.userId)) {
            batch.update(doc(db, 'notifications', notif.id), {
                status: 'cancelled',
                'payload.cancellationReason': 'Tự động hủy do người yêu cầu không còn trong ca.'
            });
            continue;
        }

        // Case 2: The request is a swap. Check if the target user is still in their target shift.
        if (payload.isSwapRequest && payload.targetUserShiftPayload) {
            const targetShiftInNewSchedule = data.shifts?.find(s => s.id === payload.targetUserShiftPayload!.shiftId);
            const targetUserStillInTheirShift = targetShiftInNewSchedule?.assignedUsers.some(u => u.userId === payload.targetUserId);

            if (!targetUserStillInTheirShift) {
                batch.update(doc(db, 'notifications', notif.id), {
                    status: 'cancelled',
                    'payload.cancellationReason': 'Tự động hủy do ca cần đổi đã thay đổi.'
                });
                continue;
            }
        }

        // Case 3: The request is pending_approval. We need to check for new conflicts.
        if (notif.status === 'pending_approval' && payload.takenBy) {
            const takerId = payload.takenBy.userId;
            const shiftToTake = shiftInNewSchedule; // We know it exists from the first check
            const allShiftsOnDay = data.shifts?.filter(s => s.date === payload.shiftDate) || [];

            const conflict = hasTimeConflict(takerId, shiftToTake, allShiftsOnDay.filter(s => s.id !== shiftToTake.id));

            if (conflict) {
                // If there's a conflict, revert the request to 'pending' and remove the 'takenBy' user.
                batch.update(doc(db, 'notifications', notif.id), {
                    status: 'pending',
                    'payload.takenBy': null,
                    'payload.declinedBy': arrayUnion(takerId) // Prevent them from seeing it again
                });
            }
        }
    }

    // Commit all notification updates first
    await batch.commit();

    // Then, save the actual schedule changes
    await setDoc(docRef, data, { merge: true });
}

export async function createDraftScheduleForNextWeek(currentDate: Date, shiftTemplates: ShiftTemplate[]): Promise<void> {
    const nextWeekDate = addDays(currentDate, 7);
    const nextWeekId = `${getISOWeekYear(nextWeekDate)}-W${getISOWeek(nextWeekDate)}`;

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
                    requiredRoles: template.requiredRoles ?? [],
                    assignedUsers: [],
                });
            }
        });
    });

    const newSchedule: Schedule = {
        weekId: nextWeekId,
        status: 'draft',
        shifts: newShifts.sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return a.timeSlot.start.localeCompare(b.timeSlot.start);
        }),
    };

    await setDoc(scheduleRef, newSchedule);
}

export async function submitShiftBusyEvidence({
    weekId,
    shift,
    user,
    message,
    newMedia = [],
    existingAttachments = [],
}: {
    weekId: string;
    shift: AssignedShift;
    user: SimpleUser;
    message: string;
    newMedia?: MediaItem[];
    existingAttachments?: MediaAttachment[];
}): Promise<void> {
    if (!weekId) {
        throw new Error('Thiếu thông tin tuần cần báo bận.');
    }
    if (!shift || !shift.id) {
        throw new Error('Không thể xác định ca thiếu người.');
    }
    if (!user || !user.userId) {
        throw new Error('Không xác định được người gửi.');
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
        throw new Error('Vui lòng nhập lý do bạn bận trong ca này.');
    }

    const docRef = doc(db, 'shift_busy_evidences', `${weekId}_${shift.id}_${user.userId}`);
    const existingDoc = await getDoc(docRef);
    const previousData = existingDoc.exists() ? (existingDoc.data() as Omit<ShiftBusyEvidence, 'id'>) : null;
    const previousAttachments = previousData?.media ?? [];

    const attachmentsToKeep = existingAttachments ? [...existingAttachments] : [];
    const uploadedAttachments = newMedia.length > 0
        ? await uploadMedia(newMedia, `shift-busy-evidences/${weekId}/${shift.id}/${user.userId}`)
        : [];

    const finalAttachments = [...attachmentsToKeep, ...uploadedAttachments];
    if (finalAttachments.length === 0) {
        throw new Error('Vui lòng đính kèm ít nhất một ảnh hoặc video minh chứng.');
    }

    const payload: Omit<ShiftBusyEvidence, 'id'> = {
        weekId,
        shiftId: shift.id,
        shiftDate: shift.date,
        shiftLabel: shift.label,
        role: shift.role,
        submittedBy: user,
        message: trimmedMessage,
        media: finalAttachments,
        submittedAt: previousData?.submittedAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, payload);

    const attachmentsToDelete = previousAttachments.filter(
        previous => !attachmentsToKeep.some(att => att.url === previous.url)
    );

    if (attachmentsToDelete.length > 0) {
        await Promise.all(attachmentsToDelete.map(att => deleteFileByUrl(att.url)));
    }
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
            } catch (e) {
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

    // Propagate template changes to existing schedules.
    // For each schedule, update any shift that references a templateId present
    // in the new templates list so label/time/role/requirements stay in sync.
    try {
        const schedulesSnapshot = await getDocs(collection(db, 'schedules'));
        const writeBatches: WriteBatch[] = [];
        let batch = writeBatch(db);
        let opsInBatch = 0;

        const tmplById = new Map(templates.map(t => [t.id, t]));

        for (const docSnap of schedulesSnapshot.docs) {
            const scheduleData = docSnap.data() as Schedule;
            if (!scheduleData.shifts || scheduleData.shifts.length === 0) continue;

            let changed = false;
            const updatedShifts = scheduleData.shifts.map(s => {
                if (!s.templateId) return s;
                const tmpl = tmplById.get(s.templateId);
                if (!tmpl) return s; // template removed or not present in new list

                const newProps = {
                    label: tmpl.label,
                    role: tmpl.role,
                    timeSlot: tmpl.timeSlot,
                    minUsers: tmpl.minUsers ?? 0,
                    requiredRoles: tmpl.requiredRoles ?? [],
                };

                const oldProps = {
                    label: s.label,
                    role: s.role,
                    timeSlot: s.timeSlot,
                    minUsers: s.minUsers ?? 0,
                    requiredRoles: s.requiredRoles ?? [],
                };

                if (JSON.stringify(oldProps) !== JSON.stringify(newProps)) {
                    changed = true;
                    return { ...s, ...newProps };
                }
                return s;
            });

            if (changed) {
                batch.update(doc(db, 'schedules', docSnap.id), { shifts: updatedShifts });
                opsInBatch++;
            }

            // Firestore limits batches to 500 operations. Commit and start a new one when close to limit.
            if (opsInBatch >= 450) {
                writeBatches.push(batch);
                batch = writeBatch(db);
                opsInBatch = 0;
            }
        }

        writeBatches.push(batch);

        for (const b of writeBatches) {
            // If no writes were staged in this batch, skip commit
            // (writeBatch has no direct inspect, we rely on that we only pushed batches we used or the final empty one)
            try {
                await b.commit();
            } catch (e) {
                console.error('Failed to propagate shift template updates to schedules:', e);
            }
        }
    } catch (e) {
        console.error('Failed to read schedules for template propagation:', e);
    }
}

// --- Schedule Constraints (Owner) ---
export function subscribeToScheduleConstraints(callback: (text: string) => void): () => void {
    const docRef = doc(db, 'app-data', 'scheduleConstraints');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
            callback((docSnap.data().constraintsText as string) || '');
        } else {
            try {
                await setDoc(docRef, { constraintsText: '' });
                callback('');
            } catch (e) {
                console.error("Permission denied to create default schedule constraints.", e);
                callback('');
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read schedule constraints: ${error.code}`);
        callback('');
    });
    return unsubscribe;
}

export async function updateScheduleConstraints(text: string): Promise<void> {
    const docRef = doc(db, 'app-data', 'scheduleConstraints');
    await setDoc(docRef, { constraintsText: text, updatedAt: serverTimestamp() }, { merge: true });
}

// --- Structured Schedule Constraints (Owner) ---
import type { ScheduleCondition } from './types';

export function subscribeToStructuredConstraints(callback: (constraints: ScheduleCondition[]) => void): () => void {
    const docRef = doc(db, 'app-data', 'scheduleConstraints');
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const raw = (data.constraints || []) as ScheduleCondition[];
            callback(Array.isArray(raw) ? raw : []);
        } else {
            try {
                await setDoc(docRef, { constraints: [] });
                callback([]);
            } catch (e) {
                console.error("Permission denied to create default structured schedule constraints.", e);
                callback([]);
            }
        }
    }, (error) => {
        console.warn(`[Firestore Read Error] Could not read structured schedule constraints: ${error.code}`);
        callback([]);
    });
    return unsubscribe;
}

function removeUndefinedDeep<T>(obj: T): T {
    if (obj === undefined) return undefined as unknown as T;
    if (obj === null) return obj;
    if (Array.isArray(obj)) {
        return obj
            .map(item => removeUndefinedDeep(item))
            .filter(item => item !== undefined) as unknown as T;
    }
    if (typeof obj === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(obj as any)) {
            if (v === undefined) continue;
            const cleaned = removeUndefinedDeep(v);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out as T;
    }
    return obj;
}

export async function updateStructuredConstraints(constraints: ScheduleCondition[]): Promise<void> {
    const docRef = doc(db, 'app-data', 'scheduleConstraints');
    // Remove any undefined fields (Firestore rejects undefined)
    const sanitized = (constraints || []).map(c => removeUndefinedDeep(c));
    await setDoc(docRef, { constraints: sanitized, updatedAt: serverTimestamp() }, { merge: true });
}

export async function requestPassShift(shiftToPass: AssignedShift, requestingUser: { uid: string, displayName: string }): Promise<Notification | null> {
    // Server-side check: Fetch the latest schedule to verify the user is still in the shift
    const weekId = `${getISOWeekYear(new Date(shiftToPass.date))}-W${getISOWeek(new Date(shiftToPass.date))}`;
    const scheduleDoc = await getDoc(doc(db, 'schedules', weekId));
    let currentShift: AssignedShift | undefined;
    if (scheduleDoc.exists()) {
        const schedule = scheduleDoc.data() as Schedule;
        currentShift = schedule.shifts.find(s => s.id === shiftToPass.id);
        if (!currentShift || !currentShift.assignedUsers.some(u => u.userId === requestingUser.uid)) {
            throw new Error("Bạn không còn trong ca làm việc này nên không thể gửi yêu cầu pass ca.");
        }
    } else {
        throw new Error("Không tìm thấy lịch làm việc cho tuần này.");
    }

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

    // derive assignedRole from the authoritative schedule snapshot we already fetched (no extra read)
    const requestingAssignedRole: string | null = currentShift?.assignedUsers.find(u => u.userId === requestingUser.uid)?.assignedRole ?? null;

    const newNotification: Omit<Notification, 'id'> = {
        type: 'pass_request',
        status: 'pending',
        createdAt: serverTimestamp() as Timestamp,
        payload: {
            weekId: weekId,
            shiftId: shiftToPass.id,
            shiftLabel: shiftToPass.label,
            shiftDate: shiftToPass.date,
            shiftTimeSlot: shiftToPass.timeSlot,
            shiftRole: shiftToPass.role,
            requestingUser: {
                userId: requestingUser.uid,
                userName: requestingUser.displayName,
                assignedRole: requestingAssignedRole
            },
            isSwapRequest: false,
            declinedBy: [],
        } as PassRequestPayload
    };
    await addDoc(collection(db, "notifications"), newNotification);
    return null;
}

export async function requestDirectPassShift(shiftToPass: AssignedShift, requestingUser: AuthUser, targetUser: ManagedUser, isSwap: boolean, targetUserShift: AssignedShift | null): Promise<Notification | null> {
    // Server-side check
    const weekId = `${getISOWeekYear(new Date(shiftToPass.date))}-W${getISOWeek(new Date(shiftToPass.date))}`;
    const scheduleDoc = await getDoc(doc(db, 'schedules', weekId));
    if (!scheduleDoc.exists()) {
        throw new Error("Không tìm thấy lịch làm việc cho tuần này.");
    }
    const schedule = scheduleDoc.data() as Schedule;

    const currentShiftA = schedule.shifts.find(s => s.id === shiftToPass.id);
    if (!currentShiftA || !currentShiftA.assignedUsers.some(u => u.userId === requestingUser.uid)) {
        throw new Error("Bạn không còn trong ca làm việc này nên không thể gửi yêu cầu.");
    }

    if (isSwap) {
        if (!targetUserShift) {
            throw new Error(`${targetUser.displayName} không có ca làm việc trong ngày này để đổi.`);
        }
        const currentShiftB = schedule.shifts.find(s => s.id === targetUserShift.id);
        if (!currentShiftB || !currentShiftB.assignedUsers.some(u => u.userId === targetUser.uid)) {
            throw new Error(`Ca làm việc của ${targetUser.displayName} đã thay đổi, không thể thực hiện đổi ca.`);
        }
    }

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

    // Find assigned role from shiftToPass assignedUsers
    const assignedUser = shiftToPass.assignedUsers.find(u => u.userId === requestingUser.uid);
    const assignedRole = assignedUser ? assignedUser.assignedRole : null;

    const payload: PassRequestPayload = {
        weekId: weekId,
        shiftId: shiftToPass.id,
        shiftLabel: shiftToPass.label,
        shiftDate: shiftToPass.date,
        shiftTimeSlot: shiftToPass.timeSlot,
        shiftRole: shiftToPass.role,
        requestingUser: {
            userId: requestingUser.uid,
            userName: requestingUser.displayName,
            assignedRole: assignedRole ?? requestingUser.role,
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
        createdAt: serverTimestamp() as Timestamp,
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

export async function acceptPassShift(notificationId: string, payload: PassRequestPayload, acceptingUser: SimpleUser, allUsers: ManagedUser[], schedule: Schedule): Promise<void> {
    if (!acceptingUser) {
        throw new Error("Người dùng chấp nhận không hợp lệ.");
    }

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

    // check shift assigned role to see if accepting user can take the shift
    const targetAssignedRole = shift.assignedUsers.find(u => u.userId === payload.requestingUser.userId)?.assignedRole;
    const acceptingUserDetails = allUsers.find(u => u.uid === acceptingUser.userId);

    if (!acceptingUserDetails) {
        throw new Error("Không tìm thấy thông tin người dùng chấp nhận ca.");
    }

    if (targetAssignedRole && acceptingUserDetails && acceptingUserDetails.role !== targetAssignedRole && acceptingUserDetails.secondaryRoles?.indexOf(targetAssignedRole) === -1) {
        throw new Error(`Bạn không thể nhận ca này vì ca yêu cầu được phân công cho vai trò "${targetAssignedRole}", trong khi vai trò của bạn là "${acceptingUserDetails.role}".`);
    }

    if (!payload.isSwapRequest) {
        const allShiftsOnDay = schedule.shifts.filter(s => s.date === payload.shiftDate);
        const shiftToTake: AssignedShift = { ...schedule.shifts.find(s => s.id === payload.shiftId)!, assignedUsers: [] };

        const conflict = hasTimeConflict(acceptingUserDetails.uid, shiftToTake, allShiftsOnDay);
        if (conflict) {
            throw new Error(`Ca này bị trùng giờ với ca "${conflict.label}" (${conflict.timeSlot.start} - ${conflict.timeSlot.end}) mà bạn đã được phân công.`);
        }
    }

    await updateDoc(notificationRef, {
        status: 'pending_approval',
        'payload.takenBy': {
            ...acceptingUser,
            assignedRole: payload.requestingUser?.assignedRole ?? targetAssignedRole ?? acceptingUserDetails.role
        }
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

            // determine original assignedRole values (prefer payload, fall back to existing shift entries)
            const requesterRole = payload.requestingUser?.assignedRole ?? shiftA.assignedUsers.find(u => u.userId === requestingUser.userId)?.assignedRole ?? null;
            const takerRole = payload.takenBy?.assignedRole ?? shiftB.assignedUsers.find(u => u.userId === takenBy.userId)?.assignedRole ?? null;

            // remove original entries
            shiftA.assignedUsers = shiftA.assignedUsers.filter(u => u.userId !== requestingUser.userId);
            shiftB.assignedUsers = shiftB.assignedUsers.filter(u => u.userId !== takenBy.userId);

            // takenBy should receive the requester's assignedRole for shiftA (if available)
            const takenByWithRole: AssignedUser = { ...takenBy, assignedRole: takenBy.assignedRole ?? requesterRole ?? takerRole };
            // requestingUser moves into shiftB and should retain (or receive) the taker's previous role
            const requestingUserWithRole: AssignedUser = { ...requestingUser, assignedRole: requestingUser.assignedRole ?? takerRole ?? requesterRole };

            shiftA.assignedUsers.push(takenByWithRole);
            shiftB.assignedUsers.push(requestingUserWithRole);

            updatedShifts[shiftA_Index] = shiftA;
            updatedShifts[shiftB_Index] = shiftB;

        } else {
            const shiftA = { ...updatedShifts[shiftA_Index] };

            // determine which role should be assigned to the taker: prefer the requestingUser.assignedRole, then the existing shift entry
            const roleToAssign = payload.requestingUser?.assignedRole ?? shiftA.assignedUsers.find(u => u.userId === requestingUser.userId)?.assignedRole ?? null;

            const conflict = hasTimeConflict(takenBy.userId, shiftA, updatedShifts.filter(s => s.date === shiftA.date));
            if (conflict) {
                transaction.update(notificationRef, { status: 'cancelled', 'payload.cancellationReason': `Tự động hủy do người nhận ca (${takenBy.userName}) bị trùng lịch.`, 'payload.takenBy': null });
                throw new Error(`SHIFT_CONFLICT: Nhân viên ${takenBy.userName} đã có ca làm việc khác (${conflict.label}) bị trùng giờ.`);
            }

            // remove the requesting user and add the taker with the appropriate assignedRole
            shiftA.assignedUsers = shiftA.assignedUsers.filter(u => u.userId !== requestingUser.userId);
            const takenByWithRole: AssignedUser = { ...takenBy, assignedRole: takenBy.assignedRole ?? roleToAssign };
            shiftA.assignedUsers.push(takenByWithRole);
            updatedShifts[shiftA_Index] = shiftA;

            // persist the assignedRole onto the notification payload so other systems/readers see it
            if (roleToAssign) {
                transaction.update(notificationRef, { 'payload.takenBy.assignedRole': roleToAssign });
            }
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
    const notificationRef = doc(db, "notifications", notificationId);
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
export function subscribeToRelevantPassRequestNotifications(userId: string, userRole: UserRole, callback: (notifications: Notification[]) => void): () => void {
    const notificationsCollection = collection(db, 'notifications');

    const myRequestsQuery = query(
        notificationsCollection,
        and(
            where('type', '==', 'pass_request'),
            or(
                where('payload.requestingUser.userId', '==', userId),
                where('payload.targetUserId', '==', userId),
                where('payload.takenBy.userId', '==', userId)
            )
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
            if (n.status === 'pending' || n.status === 'pending_approval') {
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
            if (n.status === 'pending') {
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

export function subscribeToAllPassRequestNotifications(callback: (notifications: Notification[]) => void): () => void {
    const notificationsCollection = collection(db, 'notifications');
    const q = query(
        notificationsCollection,
        where('type', '==', 'pass_request'),
        orderBy('createdAt', 'desc')
    );

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
            if (notification.status === 'pending' || notification.status === 'pending_approval') {
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
        console.warn(`[Firestore Read Error] Could not read notifications: ${error.code} - ${error.message}`);
        callback([]);
    });

    return unsubscribe;
}

export async function updatePassRequestNotificationStatus(notificationId: string, status: Notification['status'], resolver?: AuthUser): Promise<void> {
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

export async function deletePassRequestNotification(notificationId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
}

export async function addStaffToShift(weekId: string, shiftId: string, user: ManagedUser, assignedRole?: UserRole): Promise<void> {
    const docRef = doc(db, 'schedules', weekId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Schedule not found');
    const schedule = snap.data() as Schedule;
    const newShifts = schedule.shifts.map(s => {
        if (s.id !== shiftId) return s;
        if (s.assignedUsers.some(au => au.userId === user.uid)) return s;
        return {
            ...s,
            assignedUsers: [
                ...s.assignedUsers,
                { userId: user.uid, displayName: user.displayName, assignedRole: assignedRole || user.role }
            ]
        };
    });
    await updateDoc(docRef, { shifts: newShifts });
}

// --- Monthly Tasks (New Rule-Based System) ---

function isTaskScheduledForDate(task: MonthlyTask, date: Date): boolean {
    const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ...
    const dayOfMonth = getDate(date);
    const dateKey = format(date, 'yyyy-MM-dd');

    // First, check if this date is in the custom scheduled dates (works for all task types)
    if (task.scheduledDates && task.scheduledDates.includes(dateKey)) {
        return true;
    }

    // Then check the regular schedule rules based on schedule type
    switch (task.schedule.type) {
        case 'weekly':
            return task.schedule.daysOfWeek.includes(dayOfWeek);

        case 'interval':
            const startDate = parseISO(task.schedule.startDate);

            startDate.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);

            const diffInMs = date.getTime() - startDate.getTime();
            const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

            return diffInDays >= 0 && diffInDays % task.schedule.intervalDays === 0;
        case 'monthly_date':
            return task.schedule.daysOfMonth.includes(dayOfMonth);

        case 'monthly_weekday':
            const weekOfMonth = getWeekOfMonth(date); // 1-based
            const lastDayOfMonth = endOfMonth(date);
            const lastWeekOfMonth = getWeekOfMonth(lastDayOfMonth);

            return task.schedule.occurrences.some(occ => {
                if (occ.day !== dayOfWeek) return false;
                // Handle last week of month (e.g., -1 for last)
                if (occ.week < 0) {
                    const weekFromEnd = lastWeekOfMonth - weekOfMonth + 1;
                    return weekFromEnd === Math.abs(occ.week);
                }
                return occ.week === weekOfMonth;
            });

        case 'random':
            // For random type, dates are only in scheduledDates (already checked above)
            return false;

        default:
            return false;
    }
}

type MonthlyTaskSubscriptionHandler = (payload: { assignments: MonthlyTaskAssignment[]; allUsers: ManagedUser[] }) => void;

function buildMonthlyTaskAssignmentsForDate({
    targetDate,
    dateKey,
    schedule,
    allDefinedTasks,
    allUsers,
    allCompletionsForDay,
}: {
    targetDate: Date;
    dateKey: string;
    schedule: Schedule;
    allDefinedTasks: MonthlyTask[];
    allUsers: ManagedUser[];
    allCompletionsForDay: TaskCompletionRecord[];
}): MonthlyTaskAssignment[] {
    const tasksDueToday = allDefinedTasks.filter(task => {
        if (!isTaskScheduledForDate(task, new Date(targetDate))) {
            return false;
        }
        return true;
    });

    const shiftsToday = schedule.shifts.filter(s => s.date === dateKey);

    return tasksDueToday.map(task => {
        const responsibleUsersByShift = new Map<string, { shiftId: string; shiftLabel: string; users: AssignedUser[] }>();
        const allResponsibleUserIds = new Set<string>();

        shiftsToday.forEach(shift => {
            const taskAppliesToShift = (
                !task.timeOfDay ||
                isWithinInterval(parseISO(`${dateKey}T${task.timeOfDay}`), {
                    start: parseISO(`${shift.date}T${shift.timeSlot.start}`),
                    end: parseISO(`${shift.date}T${shift.timeSlot.end}`)
                })
            );

            if (taskAppliesToShift) {
                shift.assignedUsers.forEach(assignedUser => {
                    const fullUser = allUsers.find(u => u.uid === assignedUser.userId);
                    if (fullUser) {
                        const assignedRole = (assignedUser as any).assignedRole as string | undefined;

                        const roleMatches = assignedRole
                            ? (task.appliesToRole === 'Tất cả' || assignedRole === task.appliesToRole)
                            : (task.appliesToRole === 'Tất cả' || [fullUser.role, ...(fullUser.secondaryRoles || [])].includes(task.appliesToRole));

                        if (roleMatches) {
                            if (!responsibleUsersByShift.has(shift.id)) {
                                responsibleUsersByShift.set(shift.id, { shiftId: shift.id, shiftLabel: shift.label, users: [] });
                            }
                            const shiftGroup = responsibleUsersByShift.get(shift.id)!;
                            if (!shiftGroup.users.some(u => u.userId === assignedUser.userId)) {
                                shiftGroup.users.push(assignedUser);
                            }
                            allResponsibleUserIds.add(assignedUser.userId);
                        }
                    }
                });
            }
        });

        const allCompletionsForThisTask = allCompletionsForDay.filter(c => c.taskId === task.id);
        const assignedCompletions = allCompletionsForThisTask.filter(c => c.completedBy && allResponsibleUserIds.has(c.completedBy.userId));
        const otherCompletions = allCompletionsForThisTask.filter(c => !c.completedBy || !allResponsibleUserIds.has(c.completedBy.userId));

        return {
            taskId: task.id,
            taskName: task.name,
            description: task.description,
            assignedDate: dateKey,
            appliesToRole: task.appliesToRole,
            responsibleUsersByShift: Array.from(responsibleUsersByShift.values()),
            completions: assignedCompletions,
            otherCompletions,
        } as MonthlyTaskAssignment;
    });
}

function createMonthlyTaskSubscription(
    date: Date,
    handler: MonthlyTaskSubscriptionHandler,
    options?: { allUsers?: ManagedUser[]; schedule?: Schedule | null }
): () => void {
    const targetDate = new Date(date);
    const dateKey = format(targetDate, 'yyyy-MM-dd');
    const weekId = `${getISOWeekYear(targetDate)}-W${getISOWeek(targetDate)}`;

    let allDefinedTasks: MonthlyTask[] = [];
    // Caller-provided users are only considered authoritative when a non-empty array is passed.
    const callerProvidesUsers = Array.isArray(options?.allUsers) && (options!.allUsers as ManagedUser[]).length > 0;
    let allUsers: ManagedUser[] = callerProvidesUsers ? (options!.allUsers as ManagedUser[]) : [];

    // Caller-provided schedule is considered authoritative only when a non-null Schedule object is passed.
    const callerProvidesSchedule = !!options?.schedule && (options!.schedule as Schedule) !== null;
    let schedule: Schedule | null | undefined = callerProvidesSchedule ? (options!.schedule as Schedule) : undefined;

    let allCompletionsForDay: TaskCompletionRecord[] = [];

    const processAndCallback = () => {
        // If caller provided a schedule (even null), treat that as authoritative and do not wait for an internal schedule snapshot.
        if (schedule === undefined) {
            // we don't have a schedule yet and caller didn't provide one
            handler({ assignments: [], allUsers });
            return;
        }

        const assignments = buildMonthlyTaskAssignmentsForDate({
            targetDate,
            dateKey,
            schedule: schedule as Schedule,
            allDefinedTasks,
            allUsers,
            allCompletionsForDay,
        });

        handler({ assignments, allUsers });
    };

    const unsubTasks = onSnapshot(doc(db, 'app-data', 'monthlyTasks'), (docSnap) => {
        allDefinedTasks = docSnap.exists() ? ((docSnap.data().tasks as MonthlyTask[]) || []) : [];
        processAndCallback();
    });

    // Only subscribe to schedule if caller did NOT provide a populated schedule
    let unsubSchedule: (() => void) | null = null;
    if (!callerProvidesSchedule) {
        unsubSchedule = onSnapshot(doc(db, 'schedules', weekId), (docSnap) => {
            schedule = docSnap.exists() ? (docSnap.data() as Schedule) : null;
            processAndCallback();
        });
    }

    const completionsQuery = query(
        collection(db, 'monthly_task_completions'),
        where(documentId(), '>=', dateKey),
        where(documentId(), '<', `${dateKey}z`)
    );

    const unsubCompletions = onSnapshot(completionsQuery, (querySnapshot) => {
        let completions: TaskCompletionRecord[] = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (Array.isArray(data.completions)) {
                completions = completions.concat(
                    data.completions.map((c: TaskCompletionRecord) => ({
                        ...c,
                        completionId: `${docSnap.id}_${c.taskId}`
                    }))
                );
            }
        });
        allCompletionsForDay = completions;
        processAndCallback();
    });

    // Only subscribe to users if caller did NOT provide a populated users array
    let unsubUsers: (() => void) | null = null;
    if (!callerProvidesUsers) {
        unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            allUsers = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as ManagedUser));
            processAndCallback();
        });
    }

    return () => {
        try { unsubTasks(); } catch (e) { /* noop */ }
        try { unsubCompletions(); } catch (e) { /* noop */ }
        if (unsubSchedule) try { unsubSchedule(); } catch (e) { /* noop */ }
        if (unsubUsers) try { unsubUsers(); } catch (e) { /* noop */ }
    };
}

export function subscribeToMonthlyTasksForDateForStaff(
    date: Date,
    userId: string,
    callback: (assignments: MonthlyTaskAssignment[]) => void,
    options?: { allUsers?: ManagedUser[]; schedule?: Schedule | null }
): () => void {
    if (!userId) {
        callback([]);
        return () => { };
    }

    return createMonthlyTaskSubscription(date, ({ assignments, allUsers }) => {
        const targetUser = allUsers.find(u => u.uid === userId);

        if (!targetUser) {
            callback([]);
            return;
        }

        const userRoles = [targetUser.role, ...(targetUser.secondaryRoles || [])];

        const filteredAssignments = assignments.reduce<MonthlyTaskAssignment[]>((acc, assignment) => {
                // Scope responsibleUsersByShift to the current user for initial relatedness check
            const scopedResponsibleByShift = assignment.responsibleUsersByShift
                .map(({ shiftId, shiftLabel, users }) => ({
                    shiftId,
                    shiftLabel,
                    users: users.filter(u => u.userId === userId),
                }))
                .filter(group => group.users.length > 0);

            const matchesRole = assignment.appliesToRole === 'Tất cả' || (assignment.appliesToRole ? userRoles.includes(assignment.appliesToRole as UserRole) : false);

            // Determine whether this staff is related to the task. If so, they may see all completions for that task.
            const isRelated = scopedResponsibleByShift.length > 0 || matchesRole ||
                assignment.completions.some(c => c.completedBy?.userId === userId) ||
                assignment.otherCompletions.some(c => c.completedBy?.userId === userId);

            // If the user is related, include all completions for that task so staff can view reports from others.
            const completions = isRelated ? assignment.completions : assignment.completions.filter(c => c.completedBy?.userId === userId);
            const otherCompletions = isRelated ? assignment.otherCompletions : assignment.otherCompletions.filter(c => c.completedBy?.userId === userId);

            if (!isRelated) {
                // not related and no personal completions => skip
                return acc;
            }

            acc.push({
                ...assignment,
                // If the staff is related, expose the full assigned-user groups so they can see who else was responsible;
                // otherwise keep the groups scoped to the current user (keeps UI compact).
                responsibleUsersByShift: isRelated ? assignment.responsibleUsersByShift : scopedResponsibleByShift,
                completions,
                otherCompletions,
            });

            return acc;
        }, []);

        callback(filteredAssignments);
    }, options);
}

export function subscribeToMonthlyTasksForDateForOwner(
    date: Date,
    callback: (assignments: MonthlyTaskAssignment[]) => void,
    options?: { allUsers?: ManagedUser[]; schedule?: Schedule | null }
): () => void {
    return createMonthlyTaskSubscription(date, ({ assignments }) => {
        const filteredAssignments = assignments.filter(a => a.responsibleUsersByShift.length > 0 || a.otherCompletions.length > 0);
        callback(filteredAssignments);
    }, options);
}

export function subscribeToMonthlyTaskCompletionsForMonth(
    date: Date,
    callback: (completions: TaskCompletionRecord[]) => void
): () => void {
    const monthPrefix = format(date, 'yyyy-MM');
    const nextMonthDate = addMonths(date, 1);
    const nextMonthPrefix = format(nextMonthDate, 'yyyy-MM');

    const completionsQuery = query(
        collection(db, 'monthly_task_completions'),
        where(documentId(), '>=', monthPrefix),
        where(documentId(), '<', nextMonthPrefix)
    );

    const unsubscribe = onSnapshot(completionsQuery, (querySnapshot) => {
        let allCompletionsForMonth: TaskCompletionRecord[] = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.completions && Array.isArray(data.completions)) {
                allCompletionsForMonth = allCompletionsForMonth.concat(
                    data.completions.map((c: TaskCompletionRecord) => ({ 
                        ...c, 
                        completionId: `${docSnap.id}_${c.taskId}` 
                    }))
                );
            }
        });
        callback(allCompletionsForMonth);
    }, (error) => {
        console.error("Error fetching monthly task completions:", error);
        callback([]);
    });

    return unsubscribe;
}

export async function updateMonthlyTaskCompletionStatus(taskId: string, taskName: string, user: SimpleUser, date: Date, isCompleted: boolean, media?: MediaItem[], note?: string): Promise<void> {
    const dateKey = format(date, 'yyyy-MM-dd');
    const docRef = doc(db, 'monthly_task_completions', `${dateKey}_${user.userId}`);

    if (!taskId || !taskName || !user || !dateKey) {
        throw new Error("Missing required parameters for updateMonthlyTaskCompletionStatus.");
    }

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        const allCompletions = docSnap.exists() ? (docSnap.data().completions as TaskCompletionRecord[]) : [];

        const completionIndex = allCompletions.findIndex(
            c => c.taskId === taskId, // Since this doc is now user-specific, we only need to find by taskId
        );

        if (completionIndex > -1) {
            // Update existing completion record
            const currentCompletion = allCompletions[completionIndex];
            let newMediaAttachments: MediaAttachment[] | undefined = undefined;

            if (isCompleted && media && media.length > 0) {
                const uploadPath = `monthly-task-completions/${dateKey}/${user.userId}/${taskId}`;
                newMediaAttachments = await uploadMedia(media, uploadPath);
            } else if (!isCompleted && currentCompletion.media && currentCompletion.media.length > 0) {
                const deletePromises = currentCompletion.media.map(att => deleteFileByUrl(att.url));
                await Promise.all(deletePromises).catch(err => {
                    console.error("Failed to delete some media files from storage:", err);
                });
            }

            const finalMedia = [...(currentCompletion.media || []), ...(newMediaAttachments || [])];

            const updatedCompletions = [...allCompletions];
            const updatedCompletion: TaskCompletionRecord = {
                ...currentCompletion,
                note: note ?? currentCompletion.note ?? '',
            };

            // set or refresh note timestamp when a note is provided in this call
            if (note) {
                updatedCompletion.noteCreatedAt = Timestamp.now();
            }

            if (isCompleted) {
                updatedCompletion.completedAt = Timestamp.now();
                updatedCompletion.media = finalMedia;
            } else {
                // If we are not completing the task, but there's a note,
                // we should not delete existing media.
                // Only delete media if explicitly un-completing and not adding a note with media.
                if (!note) {
                    delete updatedCompletion.media;
                }
                // Preserve completion time if it exists and we are just adding a note
                if (!currentCompletion.completedAt) {
                    delete updatedCompletion.completedAt;
                }
                // if note was explicitly removed, also remove its timestamp
                if (!note && !updatedCompletion.note) {
                    delete updatedCompletion.noteCreatedAt;
                }
            }
            updatedCompletions[completionIndex] = updatedCompletion;

            transaction.set(docRef, { completions: updatedCompletions });
        } else if (isCompleted || note) {
            // Create new completion record
            let newMediaAttachments: MediaAttachment[] | undefined = undefined;
            if (media && media.length > 0) {
                const uploadPath = `monthly-task-completions/${dateKey}/${user.userId}/${taskId}`;
                newMediaAttachments = await uploadMedia(media, uploadPath);
            }

            const newCompletion: TaskCompletionRecord = {
                taskId,
                taskName,
                completedBy: user,
                assignedDate: dateKey,
                ...(isCompleted && { completedAt: Timestamp.now() }),
                ...(newMediaAttachments && { media: newMediaAttachments }),
                ...(note && { note: note, noteCreatedAt: Timestamp.now() }),
            };

            const updatedCompletions = [...allCompletions, newCompletion];

            transaction.set(docRef, { completions: updatedCompletions });
        }
    });
}

export async function deleteMonthlyTaskCompletion(taskId: string, userId: string, dateKey: string): Promise<void> {
    const docRef = doc(db, 'monthly_task_completions', `${dateKey}_${userId}`);

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
            console.warn(`Completion document not found for ${dateKey}_${userId}`);
            return;
        }

        const allCompletions = docSnap.data().completions as TaskCompletionRecord[];
        const completionToDelete = allCompletions.find(c => c.taskId === taskId);

        if (!completionToDelete) {
            console.warn(`Completion record not found for task ${taskId} in document ${dateKey}_${userId}`);
            return;
        }

        // Delete associated media from storage
        if (completionToDelete.media && completionToDelete.media.length > 0) {
            const deletePromises = completionToDelete.media.map(att => deleteFileByUrl(att.url));
            await Promise.all(deletePromises).catch(err => {
                console.error("Failed to delete some media files from storage during completion deletion:", err);
            });
        }

        const updatedCompletions = allCompletions.filter(c => c.taskId !== taskId);

        transaction.update(docRef, { completions: updatedCompletions });
    });
}
