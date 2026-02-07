import type { AssignedShift, TimeSlot, MonthlyTask, Schedule, ManagedUser, TaskCompletionRecord, AssignedUser, Availability, UserRole } from './types';
import { set, eachDayOfInterval, startOfMonth, endOfMonth, getDay, getDate, getWeekOfMonth, parseISO, format, isWithinInterval } from 'date-fns';

/**
 * Checks if the current time is within the allowed timeframe of any of the user's assigned shifts for the day.
 * The allowed timeframe is from 1 hour before the shift starts to 1 hour after the shift ends.
 * @param userShifts An array of the user's assigned shifts for the day.
 * @returns True if the user is currently within an active shift timeframe, otherwise false.
 */
export function isUserOnActiveShift(userShifts: AssignedShift[]): boolean {
    if (!userShifts || userShifts.length === 0) {
        return false;
    }

    const now = new Date();

    return userShifts.some(shift => {
        const [startHour, startMinute] = shift.timeSlot.start.split(':').map(Number);
        const [endHour, endMinute] = shift.timeSlot.end.split(':').map(Number);
        
        const shiftDate = new Date(shift.date);
        
        const validStartTime = set(shiftDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
        validStartTime.setHours(validStartTime.getHours() - 1); 

        const validEndTime = set(shiftDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
        validEndTime.setHours(validEndTime.getHours() + 1);

        return isWithinInterval(now, { start: validStartTime, end: validEndTime });
    });
}

/**
 * Gets the keys of the main shifts (sang, trua, toi) that are currently active.
 * The allowed timeframe is from 1 hour before the shift starts to 1 hour after the shift ends.
 * @param userShifts An array of the user's assigned shifts for the day.
 * @returns An array of active main shift keys ('sang', 'trua', 'toi').
 */
export function getActiveShifts(userShifts: AssignedShift[]): AssignedShift[] {
  if (!userShifts || userShifts.length === 0) {
      return [];
  }

  const now = new Date();

  return userShifts.filter(shift => {
      const [startHour, startMinute] = shift.timeSlot.start.split(':').map(Number);
      const [endHour, endMinute] = shift.timeSlot.end.split(':').map(Number);
      
      const shiftDate = new Date(shift.date);
      
      const validStartTime = set(shiftDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
      validStartTime.setHours(validStartTime.getHours() - 1); 

      const validEndTime = set(shiftDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
      validEndTime.setHours(validEndTime.getHours() + 1);

      return isWithinInterval(now, { start: validStartTime, end: validEndTime });
  });
}


/**
 * Checks if a user is available for a given shift time slot based on their registered availability.
 * @param userId The ID of the user to check.
 * @param shiftSlot The time slot of the shift.
 * @param dailyAvailability An array of all availability records for that day.
 * @returns True if the user has an availability slot that fully contains the shift slot.
 */
export function isUserAvailable(
  userId: string,
  shiftSlot: TimeSlot,
  dailyAvailability: Availability[]
): boolean {
  const userAvailability = dailyAvailability.find(avail => avail.userId === userId);

  if (!userAvailability) {
    return false; // User has not registered any availability for this day.
  }
  
  const shiftStart = parseTime(shiftSlot.start);
  const shiftEnd = parseTime(shiftSlot.end);

    // Merge overlapping and adjacent available slots first so that sequences like
    // [07:00-12:00, 12:00-17:00] become [07:00-17:00] which allows a shift
    // spanning the full range to be recognized as available.
    const merged = mergeTimeSlots(userAvailability.availableSlots);

    // Check if any merged slot fully contains the entire shift duration.
    return merged.some(slot => {
        const availableStart = parseTime(slot.start);
        const availableEnd = parseTime(slot.end);

        return availableStart <= shiftStart && availableEnd >= shiftEnd;
    });
}

/**
 * Merge overlapping or adjacent time slots (same-day only).
 * Examples:
 *  - [07:00-12:00, 12:00-17:00] -> [07:00-17:00]
 *  - [07:00-10:00, 06:00-12:00] -> [06:00-12:00]
 * Slots with end <= start (overnight or invalid) are ignored.
 */
export function mergeTimeSlots(slots: TimeSlot[]): TimeSlot[] {
    if (!slots || slots.length === 0) return [];

    // Convert to numeric ranges and filter invalid/overnight slots (end must be > start)
    const ranges = slots
        .map(s => ({ start: parseTime(s.start), end: parseTime(s.end), raw: s }))
        .filter(r => r.end > r.start)
        .sort((a, b) => a.start - b.start || b.end - a.end);

    const merged: { start: number; end: number }[] = [];
    for (const r of ranges) {
        if (merged.length === 0) {
            merged.push({ start: r.start, end: r.end });
            continue;
        }

        const last = merged[merged.length - 1];

        // If overlapping or adjacent (no gap), merge them
        // Use a small epsilon to avoid floating point equality issues
        const EPS = 1e-9;
        if (r.start <= last.end + EPS) {
            last.end = Math.max(last.end, r.end);
        } else {
            merged.push({ start: r.start, end: r.end });
        }
    }

    // Convert back to TimeSlot[] using HH:mm formatting
    return merged.map(m => ({ start: formatTime(m.start), end: formatTime(m.end) }));
}

function formatTime(timeNum: number): string {
    const hours = Math.floor(timeNum);
    const minutes = Math.round((timeNum - hours) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
}

/**
 * Checks if assigning a user to a shift creates a time conflict with other shifts they are already assigned to on the same day.
 * @param userId The user ID to check.
 * @param shiftToAdd The new shift being considered for assignment.
 * @param allShiftsOnDay An array of all shifts scheduled for that day.
 * @returns The conflicting shift object if a conflict is found, otherwise null.
 */
export function hasTimeConflict(
  userId: string,
  shiftToAdd: AssignedShift,
  allShiftsOnDay: AssignedShift[]
): AssignedShift | null {
  const startA = parseTime(shiftToAdd.timeSlot.start);
  const endA = parseTime(shiftToAdd.timeSlot.end);

  // 1. Get all shifts the user is already assigned to on that day.
  const existingUserShifts = allShiftsOnDay.filter(s =>
    s.assignedUsers.some(u => u.userId === userId)
  );

  // 2. Check for time overlap against each existing shift.
  for (const existingShift of existingUserShifts) {
    const startB = parseTime(existingShift.timeSlot.start);
    const endB = parseTime(existingShift.timeSlot.end);

    // Overlap exists if (StartA < EndB) and (StartB < EndA)
    if (startA < endB && startB < endA) {
      return existingShift; // Return the specific shift that conflicts
    }
  }
  
  return null; // No conflict found
}

// Monthly task
function isTaskScheduledForDate(task: MonthlyTask, date: Date): boolean {
    const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ...
    const dayOfMonth = getDate(date);

    if (task.schedule.type === 'random') {
        return task.scheduledDates?.includes(format(date, 'yyyy-MM-dd')) ?? false;
    }

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

        default:
            return false;
    }
}

/* Local helper type used by getAssignmentsForMonth */
type DailyAssignment = {
  date: string;
  assignedUsers: AssignedUser[];
  assignedUsersByShift: { shiftId: string; shiftLabel: string; timeSlot: TimeSlot; users: AssignedUser[] }[];
  completions: TaskCompletionRecord[];
  appliesToRole?: UserRole | 'Tất cả';
};

/**
 * Build per-task, per-day assignment summaries for a month (up to today).
 *
 * Inputs:
 *  - month: the month to report on (any Date within that month)
 *  - tasks: list of MonthlyTask definitions (scheduling rules live here)
 *  - schedules: array of Schedule objects (each contains shifts[] for weeks in the month)
 *  - allUsers: user profiles used for role-resolution
 *  - completions: flattened completion records (may contain results for many users/dates)
 *
 * Output: a map keyed by task.name -> array of DailyAssignment (one entry per date with activity)
 *
 * Notes / important behaviour:
 *  - The function only returns days <= today (it intentionally excludes future dates).
 *  - Completions are indexed by `taskName + assignedDate` (legacy behaviour) —
 *    if two tasks share the same name their completions will be merged. Prefer using
 *    `task.id` for indexing in future refactors.
 *  - Role-matching order of precedence:
 *      1) `AssignedUser.assignedRole` (slot-level role) if present — this is authoritative;
 *      2) fallback to `ManagedUser.role` + `secondaryRoles`.
 *  - WARNING: `isTaskScheduledForDate` mutates the Date argument (it calls setHours). Callers
 *    should pass cloned Date objects if they need the original value preserved.
 *  - Complexity: roughly O(days × shifts × assignedUsers) — acceptable for typical store sizes
 *    but may be slow for extremely large schedules.
 */
export function getAssignmentsForMonth(
    month: Date,
    tasks: MonthlyTask[],
    schedules: Schedule[],
    allUsers: ManagedUser[],
    completions: TaskCompletionRecord[]
): { [taskName: string]: DailyAssignment[] } {
    const assignmentsByTask: { [taskName: string]: DailyAssignment[] } = {};
    // Defensive early return when required datasets are missing
    if (!tasks.length || !schedules.length || !allUsers.length) return assignmentsByTask;

    // Build list of days in the month but only consider days up to today (no future days)
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysToIterate = daysInMonth.filter(d => d.getTime() <= today.getTime());

    // Index completions for O(1) lookup by (taskName, date)
    // NOTE: legacy behaviour uses taskName — this can collide if names are duplicated.
    const completionsByTaskAndDate: { [key: string]: TaskCompletionRecord[] } = {};
    completions.forEach(c => {
        const key = `${c.taskName}__${c.assignedDate}`;
        if (!completionsByTaskAndDate[key]) {
            completionsByTaskAndDate[key] = [];
        }
        completionsByTaskAndDate[key].push(c);
    });

    // Main loop: for each defined task, inspect every past date in the month and
    // gather assigned users (by shift) + any completions for that date.
    tasks.forEach(task => {
        assignmentsByTask[task.name] = [];
        daysToIterate.forEach(day => {
            // isTaskScheduledForDate determines whether the task should run on this day
            // (it encapsulates weekly/interval/monthly/random scheduling rules).
            if (isTaskScheduledForDate(task, day)) {
                const dateKey = format(day, 'yyyy-MM-dd');

                // Collect all shifts that occur on this date across the supplied schedules
                const shiftsToday = schedules.flatMap(s => s.shifts).filter(s => s.date === dateKey);

                // responsibleUsers: unique set of AssignedUser for the entire date
                const responsibleUsers = new Map<string, AssignedUser>();

                // responsibleUsersByShift: preserves grouping so the UI can show per-shift groups
                const responsibleUsersByShift = new Map<string, { shiftId: string; shiftLabel: string; timeSlot: TimeSlot; users: AssignedUser[] }>();

                // Inspect each shift and find which assigned users match the task's role requirement
                shiftsToday.forEach(shift => {
                    const taskAppliesToShift = !task.timeOfDay || isWithinInterval(parseISO(`${dateKey}T${task.timeOfDay}`), {
                        start: parseISO(`${shift.date}T${shift.timeSlot.start}`),
                        end: parseISO(`${shift.date}T${shift.timeSlot.end}`)
                    });

                    if (taskAppliesToShift) {
                        let usersInShiftForTask: AssignedUser[] = [];

                        // For each assigned user on the shift, resolve role and check match
                        shift.assignedUsers.forEach(assignedUser => {
                            const fullUser = allUsers.find(u => u.uid === assignedUser.userId);
                            if (fullUser) {
                                // slot-level assignedRole (if present) is authoritative
                                const assignedRole = (assignedUser as any).assignedRole as string | undefined;

                                const roleMatches = assignedRole
                                    ? (assignedRole === 'Bất kỳ' || task.appliesToRole === 'Tất cả' || assignedRole === task.appliesToRole)
                                    : (task.appliesToRole === 'Tất cả' || [fullUser.role, ...(fullUser.secondaryRoles || [])].includes(task.appliesToRole));

                                if (roleMatches) {
                                    // Keep a deduplicated list of responsible users for the date
                                    if (!responsibleUsers.has(assignedUser.userId)) {
                                        responsibleUsers.set(assignedUser.userId, assignedUser);
                                    }
                                    usersInShiftForTask.push(assignedUser);
                                }
                            }
                        });

                        if (usersInShiftForTask.length > 0) {
                            responsibleUsersByShift.set(shift.id, {
                                shiftId: shift.id,
                                shiftLabel: shift.label,
                                timeSlot: shift.timeSlot,
                                users: usersInShiftForTask
                            });
                        }
                    }
                });

                // Attach completions for this task/date (legacy keying by task.name)
                const dailyCompletions = completionsByTaskAndDate[`${task.name}__${dateKey}`] || [];

                // Only emit a DailyAssignment when there is at least one responsible user or a completion
                if (responsibleUsers.size > 0 || dailyCompletions.length > 0) {
                    assignmentsByTask[task.name].push({
                        date: dateKey,
                        assignedUsers: Array.from(responsibleUsers.values()),
                        assignedUsersByShift: Array.from(responsibleUsersByShift.values()),
                        completions: dailyCompletions,
                        appliesToRole: task.appliesToRole
                    });
                }
            }
        });
    });

    return assignmentsByTask;
}

/**
 * Calculates the total duration in hours from an array of time slots.
 * @param slots An array of TimeSlot objects.
 * @returns The total number of hours.
 */
export function calculateTotalHours(slots: TimeSlot[]): number {
  return slots.reduce((total, slot) => {
    const start = parseTime(slot.start);
    const end = parseTime(slot.end);
    if (end <= start) return total; // Handle overnight or invalid slots
    return total + (end - start);
  }, 0);
}


/**
 * Helper function to parse "HH:mm" time string into a number for easy comparison.
 * e.g., "08:30" -> 8.5
 */
function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + (minutes / 60);
}
