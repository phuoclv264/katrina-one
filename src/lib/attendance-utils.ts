
import type { AttendanceRecord, AssignedShift, Schedule } from './types';
import { differenceInMinutes, parseISO } from 'date-fns';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import React from 'react';

export function getShiftDetails(shiftId: string, schedules: Record<string, Schedule>): { shift: AssignedShift | null, weekId: string | null } {
    for (const weekId in schedules) {
        const schedule = schedules[weekId];
        const shift = schedule.shifts.find(s => s.id === shiftId);
        if (shift) {
            return { shift, weekId };
        }
    }
    return { shift: null, weekId: null };
}

export function getStatusInfo(record: AttendanceRecord, shift: AssignedShift | null): { text: string; icon: React.ReactNode; color: string } {
    if (record.status === 'auto-completed') {
        return { text: 'Tự động kết thúc', icon: React.createElement(Clock), color: 'text-amber-600' };
    }
    if (!shift) {
        return { text: 'Không rõ', icon: React.createElement(XCircle), color: 'text-muted-foreground' };
    }

    const checkInTime = parseISO(record.checkInTime as string);
    const shiftStartTime = parseISO(`${shift.date}T${shift.timeSlot.start}`);
    
    const minutesLate = differenceInMinutes(checkInTime, shiftStartTime);

    if (minutesLate <= 5) {
        return { text: 'Đúng giờ', icon: React.createElement(CheckCircle), color: 'text-green-600' };
    } else {
        return { text: `Trễ ${minutesLate} phút`, icon: React.createElement(Clock), color: 'text-destructive' };
    }
}
