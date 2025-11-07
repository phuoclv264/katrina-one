
import { Timestamp } from '@google-cloud/firestore';
import type { AttendanceRecord, AssignedShift, Schedule } from './types';
import { differenceInMinutes, format, isWithinInterval, set } from 'date-fns';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import React from 'react';

export function getShiftDetails(shiftId: string, schedules: Record<string, Schedule>): { shift: AssignedShift | null, weekId: string | null } {
    if (!shiftId) return { shift: null, weekId: null };
    for (const weekId in schedules) {
        const schedule = schedules[weekId];
        const shift = schedule.shifts.find(s => s.id === shiftId);
        if (shift) {
            return { shift, weekId };
        }
    }
    return { shift: null, weekId: null };
}

export function findShiftForRecord(record: AttendanceRecord, schedules: Record<string, Schedule>): AssignedShift[] {
    const checkInTime = (record.checkInTime as Timestamp).toDate();
    const checkOutTime = record.checkOutTime ? (record.checkOutTime as Timestamp).toDate() : null;
    const recordDate = format(checkInTime, 'yyyy-MM-dd');
    const allMatchingShifts: AssignedShift[] = [];

    for (const weekId in schedules) {
        const schedule = schedules[weekId];
        const matchingShiftsInWeek = schedule.shifts.filter(shift => {
            if (shift.date !== recordDate || !shift.assignedUsers.some(u => u.userId === record.userId)) {
                return false;
            }

            const [startHour, startMinute] = shift.timeSlot.start.split(':').map(Number);
            const [endHour, endMinute] = shift.timeSlot.end.split(':').map(Number);

            const shiftDate = new Date(shift.date);
            const shiftStartTime = set(shiftDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
            const shiftEndTime = set(shiftDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });

            // If there's a check-out time, check if the attendance record interval overlaps with the shift interval.
            if (checkOutTime) {
                return checkInTime < shiftEndTime && checkOutTime > shiftStartTime;
            }

            return isWithinInterval(checkInTime, { start: shiftStartTime.setHours(shiftStartTime.getHours() - 1), end: shiftEndTime });         
        });
        allMatchingShifts.push(...matchingShiftsInWeek);
    }
    return allMatchingShifts;
}

export function getStatusInfo(record: AttendanceRecord, shifts: AssignedShift[]): { text: string; icon: React.ReactNode; color: string } {
    // Handle special statuses first
    if (record.status === 'auto-completed') {
        return { text: 'Tự động kết thúc', icon: React.createElement(Clock), color: 'text-amber-600' };
    }
    if (record.status === 'pending_late') {
        return { text: 'Chờ chấm công', icon: React.createElement(Clock), color: 'text-blue-600' };
    }

    // If no check-in time, we can't determine the status.
    if (!record.checkInTime) {
        return { text: 'Chưa chấm công', icon: React.createElement(XCircle), color: 'text-muted-foreground' };
    }

    // If there are no associated shifts, it's an off-shift record.
    if (shifts.length === 0) {
        if (record.status === 'in-progress') {
            return { text: 'Đang làm ngoài giờ', icon: React.createElement(Clock), color: 'text-blue-600' };
        }
        return { text: 'Đã hoàn thành', icon: React.createElement(CheckCircle), color: 'text-green-600' };
    }

    // For records with shifts, find the earliest start and latest end time if multiple shifts are covered.
    const earliestShiftStart = new Date(Math.min(...shifts.map(s => new Date(`${s.date}T${s.timeSlot.start}`).getTime())));
    
    if (earliestShiftStart.getHours() < 6) {
        earliestShiftStart.setHours(6, 0, 0, 0);
    }
    
    const latestShiftEnd = new Date(Math.max(...shifts.map(s => new Date(`${s.date}T${s.timeSlot.end}`).getTime())));

    const checkInTime = (record.checkInTime as Timestamp).toDate();
    const checkOutTime = record.checkOutTime ? (record.checkOutTime as Timestamp).toDate() : null;

    // --- Check-in status ---
    const checkInDiff = differenceInMinutes(checkInTime, earliestShiftStart);
    let checkInStatus = '';
    if (checkInDiff > 5) {
        checkInStatus = `Đến trễ ${checkInDiff} phút`;
    } else if (checkInDiff < -5) {
        checkInStatus = `Đến sớm ${Math.abs(checkInDiff)} phút`;
    } else {
        checkInStatus = 'Đến đúng giờ';
    }

    // --- Check-out status ---
    if (!checkOutTime) {
        return { text: 'Đang làm việc', icon: React.createElement(Clock), color: 'text-blue-600' };
    }

    const checkOutDiff = differenceInMinutes(checkOutTime, latestShiftEnd);
    let checkOutStatus = '';
    if (checkOutDiff > 5) {
        checkOutStatus = `Về trễ ${checkOutDiff} phút`;
    } else if (checkOutDiff < -5) {
        checkOutStatus = `Về sớm ${Math.abs(checkOutDiff)} phút`;
    } else {
        checkOutStatus = 'Về đúng giờ';
    }

    const isPerfect = checkInStatus === 'Đến đúng giờ' && checkOutStatus === 'Về đúng giờ';

    return {
        text: `${checkInStatus} - ${checkOutStatus}`,
        icon: isPerfect ? React.createElement(CheckCircle) : React.createElement(Clock),
        color: isPerfect ? 'text-green-600' : (checkInDiff > 5 || checkOutDiff < -5 ? 'text-destructive' : 'text-amber-600'),
    };
}
