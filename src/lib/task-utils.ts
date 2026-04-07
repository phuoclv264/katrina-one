import { Task, ShiftReport, AssignedShift, ManagedUser } from './types';
import { calculateAdjustedMinCompletions } from './shift-utils';
import { Timestamp } from 'firebase/firestore';
import { toDateSafe } from './utils';

function parseCompletionTimestamp(timestamp: unknown, referenceMs?: number): Date | null {
    if (!timestamp) {
        return null;
    }

    if (typeof timestamp === 'object' && timestamp !== null && typeof (timestamp as any)?.toDate === 'function') {
        return (timestamp as any).toDate();
    }

    const candidateDate = toDateSafe(timestamp);
    if (candidateDate && !Number.isNaN(candidateDate.getTime())) {
        return candidateDate;
    }

    const text = String(timestamp).trim();
    const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
        const hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2]);
        const second = Number(timeMatch[3] || '0');

        const baseDate = referenceMs ? new Date(referenceMs) : new Date();
        if (Number.isNaN(baseDate.getTime())) {
            return null;
        }

        const normalized = new Date(baseDate);
        normalized.setHours(hour, minute, second, 0);
        return normalized;
    }

    return null;
}

export interface TaskProgress {
    task: Task;
    current: number;
    required: number;
    isDone: boolean;
}

export function calculateStaffTaskProgress(
    tasks: Task[],
    staffReport: ShiftReport | undefined,
    allShiftReports: ShiftReport[],
    shiftKey: string,
    user: ManagedUser | { gender?: 'Nam' | 'Nữ' | 'Khác' },
    activeShifts: Pick<AssignedShift, 'templateId' | 'timeSlot'>[],
    checkInTime?: number | null,
    nowTime: number = new Date().getTime()
): TaskProgress[] {
    const activeShiftTemplateIds = activeShifts.map(s => s.templateId).filter(Boolean);
    const hasSpecificTasks = tasks.some(t =>
        t.shiftPreference &&
        t.shiftPreference.length > 0 &&
        activeShiftTemplateIds.some(id => t.shiftPreference!.includes(id))
    );

    const activeShift = activeShifts.length > 0 ? activeShifts[0] : null;

    return tasks.reduce<TaskProgress[]>((acc, task) => {
        const hasPreference = task.shiftPreference && task.shiftPreference.length > 0;
        const matchesActiveShift = hasPreference && activeShiftTemplateIds.some(id => task.shiftPreference!.includes(id));

        if (hasSpecificTasks && !matchesActiveShift && shiftKey !== 'bartender_hygiene') {
            return acc;
        }

        if (shiftKey === 'bartender_hygiene' && hasPreference && !matchesActiveShift) {
            return acc;
        }

        if (task.genderPreference && task.genderPreference !== 'Tất cả' && task.genderPreference !== user.gender) {
            return acc;
        }

        const baseRequired = task.minCompletions || 1;
        // We pass the string shiftKey correctly. For bartender we pass '' or 'bartender_hygiene'
        const required = calculateAdjustedMinCompletions(baseRequired, shiftKey === 'bartender_hygiene' ? '' : shiftKey, activeShift?.timeSlot as any);

        let current = 0;
        if (task.isTeamJob) {
            // If a team job, we combine completions from all reports
            // If checkInTime is provided, we filter out completions that happened outside this user's shift coverage window
            const allCompletionsInRange = allShiftReports.flatMap(r => {
                const completions = r.completedTasks[task.id] || [];
                if (checkInTime && shiftKey === 'bartender_hygiene') {
                    return completions.filter(c => {
                        let completedAt = c.timestamp ? new Date(c.timestamp) : new Date();
                        if (shiftKey === 'bartender_hygiene') {
                            completedAt = parseCompletionTimestamp(c.timestamp, checkInTime || nowTime) || new Date();
                        }
                        if (!completedAt || Number.isNaN(completedAt.getTime())) {
                            return false;
                        }
                        const time = completedAt.getTime();
                        return time >= checkInTime && time <= nowTime;
                    });
                }
                return completions;
            });
            current = allCompletionsInRange.length;
        } else {
            // Individual job
            const completions = staffReport?.completedTasks[task.id] || [];
            current = completions.length;
        }

        acc.push({
            task,
            current,
            required,
            isDone: current >= required
        });

        return acc;
    }, []);
}
