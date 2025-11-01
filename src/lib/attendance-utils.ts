
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

export function getStatusInfo(record: AttendanceRecord, shift: AssignedShift | null): { text: string; icon: React.ReactNode; color: string } {
    if (record.status === 'auto-completed') {
        return { text: 'Tự động kết thúc', icon: React.createElement(Clock), color: 'text-amber-600' };
    }
    if (record.status === 'completed' && !shift) {
        return { text: 'Đã hoàn thành', icon: React.createElement(CheckCircle), color: 'text-green-600' };
    }
    if (!shift) {
        return { text: 'Không rõ', icon: React.createElement(XCircle), color: 'text-muted-foreground' };
    }

    const checkInTime = new Date((record.checkInTime as Timestamp).seconds * 1000);

    const shiftStartTime = new Date(shift.date + 'T' + shift.timeSlot.start);
    
    const minutesLate = differenceInMinutes(checkInTime, shiftStartTime);

    if (minutesLate <= 5) {
        return { text: 'Đúng giờ', icon: React.createElement(CheckCircle), color: 'text-green-600' };
    } else {
        return { text: `Trễ ${minutesLate} phút`, icon: React.createElement(Clock), color: 'text-destructive' };
    }
}
