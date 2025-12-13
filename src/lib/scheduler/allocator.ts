import type { AssignedShift, Availability, ManagedUser, ScheduleRunResult, Assignment, UserRole } from '@/lib/types';
import { normalizeConstraints, NormalizedContext } from './constraints';
import { isUserAvailable, hasTimeConflict, calculateTotalHours } from '@/lib/schedule-utils';

type Counters = {
  weekShifts: Map<string, number>; // userId -> assigned count
  weekHours: Map<string, number>; // userId -> assigned hours
  dailyShifts: Map<string, Map<string, number>>; // date -> (userId -> count)
};

function initCounters(shifts: AssignedShift[]): Counters {
  const weekShifts = new Map<string, number>();
  const weekHours = new Map<string, number>();
  const dailyShifts = new Map<string, Map<string, number>>();
  // Seed with existing assignments
  for (const shift of shifts) {
    const dateKey = shift.date;
    const duration = calculateTotalHours([shift.timeSlot]);
    const dailyMap = dailyShifts.get(dateKey) || new Map<string, number>();
    for (const u of shift.assignedUsers) {
      weekShifts.set(u.userId, (weekShifts.get(u.userId) || 0) + 1);
      weekHours.set(u.userId, (weekHours.get(u.userId) || 0) + duration);
      dailyMap.set(u.userId, (dailyMap.get(u.userId) || 0) + 1);
    }
    dailyShifts.set(dateKey, dailyMap);
  }
  return { weekShifts, weekHours, dailyShifts };
}

function roleMatches(user: ManagedUser, role: UserRole | 'Bất kỳ'): boolean {
  if (role === 'Bất kỳ') return true;
  return user.role === role || (user.secondaryRoles || []).includes(role);
}

export function allocate(
  shifts: AssignedShift[],
  users: ManagedUser[],
  availability: Availability[],
  ctx: NormalizedContext,
  mode: 'merge' | 'replace' = 'merge',
): ScheduleRunResult {
  const assignments: Assignment[] = [];
  const unfilled: { shiftId: string; role: UserRole | 'Bất kỳ'; remaining: number }[] = [];
  const warnings: string[] = [];

  const workingShifts: AssignedShift[] = mode === 'replace'
    ? shifts.map(s => ({ ...s, assignedUsers: [] }))
    : shifts;

  const counters = initCounters(workingShifts);

  // Helper to check caps
  const canAssign = (userId: string, dateKey: string, durationHours: number) => {
    const caps = ctx.capsByUser.get(userId);
    const weekCount = counters.weekShifts.get(userId) || 0;
    const weekHours = counters.weekHours.get(userId) || 0;
    const dailyMap = counters.dailyShifts.get(dateKey) || new Map<string, number>();
    const dailyCount = dailyMap.get(userId) || 0;

    if (!caps) return true;
    if (weekCount + 1 > caps.maxShiftsPerWeek) return false;
    if (weekHours + durationHours > caps.maxHoursPerWeek) return false;
    if (dailyCount + 1 > caps.maxPerDay) return false;
    return true;
  };

  const addAssignment = (shift: AssignedShift, userId: string) => {
    assignments.push({ shiftId: shift.id, role: shift.role, userId });
    const duration = calculateTotalHours([shift.timeSlot]);
    counters.weekShifts.set(userId, (counters.weekShifts.get(userId) || 0) + 1);
    counters.weekHours.set(userId, (counters.weekHours.get(userId) || 0) + duration);
    const dailyMap = counters.dailyShifts.get(shift.date) || new Map<string, number>();
    dailyMap.set(userId, (dailyMap.get(userId) || 0) + 1);
    counters.dailyShifts.set(shift.date, dailyMap);

    // Keep workingShifts in sync so conflict checks see newly added assignments
    const userName = users.find(u => u.uid === userId)?.displayName || userId;
    shift.assignedUsers = [...shift.assignedUsers, { userId, userName }];
  };

  // Apply forced assignments first
  for (const f of ctx.forcedAssignments) {
    const shift = workingShifts.find(s => s.id === f.shiftId);
    if (!shift) {
      warnings.push(`FORCE_MISSING_SHIFT: ${f.shiftId}`);
      continue;
    }
    const alreadyInShift = shift.assignedUsers.some(u => u.userId === f.userId);
    if (alreadyInShift) continue;

    // Availability and conflict checks
    const dailyAvailability = availability.filter(a => a.date === shift.date);
    const isAvail = isUserAvailable(f.userId, shift.timeSlot, dailyAvailability);
    const conflict = hasTimeConflict(f.userId, shift, workingShifts.filter(s => s.date === shift.date));
    if (!isAvail) {
      if (ctx.strictAvailability) {
        warnings.push(`FORCE_SKIPPED_UNAVAILABLE: user ${f.userId} not available for ${shift.id}`);
        continue; // Skip assignment
      } else {
        warnings.push(`FORCE_NOT_AVAILABLE: user ${f.userId} for ${shift.id}`);
      }
    }
    if (conflict) {
      warnings.push(`FORCE_CONFLICT: user ${f.userId} conflicts with ${conflict.label}`);
      continue; // Do not allow overlapping forced assignments
    }

    // Role-based max cap check
    const userObj = users.find(u => u.uid === f.userId);
    if (userObj) {
      const currentRoleAssigned = shift.assignedUsers.filter(u => (users.find(x => x.uid === u.userId)?.role) === userObj.role).length
        + assignments.filter(a => a.shiftId === shift.id && (users.find(x => x.uid === a.userId)?.role) === userObj.role).length;
      const roleMax = ctx.maxByShiftRole.get(shift.id)?.get(userObj.role) ?? Number.POSITIVE_INFINITY;
      if (currentRoleAssigned + 1 > roleMax) {
        warnings.push(`FORCE_EXCEEDS_ROLE_MAX: user ${f.userId} role ${userObj.role} on ${shift.id}`);
      }
    }

    // Respect caps but still assign; emit warning if exceeded
    const duration = calculateTotalHours([shift.timeSlot]);
    const okCaps = canAssign(f.userId, shift.date, duration);
    if (!okCaps) warnings.push(`FORCE_EXCEEDS_CAPS: user ${f.userId} for ${shift.id}`);
    addAssignment(shift, f.userId);
  }

  // Allocate demand
  for (const shift of workingShifts) {
    const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
    const rolesToFill = new Set<UserRole | 'Bất kỳ'>([shift.role, ...maxRoleMap.keys() as any]);
    for (const role of rolesToFill) {
      const baseTarget = role === shift.role
        ? (maxRoleMap.get(role) ?? (shift.minUsers ?? 0))
        : (maxRoleMap.get(role) ?? 0);
      const count = Math.max(0, baseTarget);
      const currentAssignedCount = shift.assignedUsers.filter(u => roleMatches(users.find(x => x.uid === u.userId)!, role)).length
        + assignments.filter(a => a.shiftId === shift.id && roleMatches(users.find(x => x.uid === a.userId)!, role)).length;
      const roleMax = maxRoleMap.get(role) ?? Number.POSITIVE_INFINITY;
      let remaining = Math.max(0, Math.min(count, roleMax) - currentAssignedCount);
      if (remaining <= 0) continue;

      const duration = calculateTotalHours([shift.timeSlot]);
      const dailyAvailability = availability.filter(a => a.date === shift.date);
      const allShiftsOnDay = workingShifts.filter(s => s.date === shift.date);
      const priorities = ctx.prioritiesByShift.get(shift.id) || new Map<string, number>();

      const candidates = users.filter(u => roleMatches(u, role));

      const candidateScores = candidates.map(u => {
        const key = `${u.uid}:${shift.id}`;
        const banned = ctx.bannedPairs.has(key);
        const alreadyAssignedHere = shift.assignedUsers.some(x => x.userId === u.uid) || assignments.some(a => a.shiftId === shift.id && a.userId === u.uid);
        const avail = isUserAvailable(u.uid, shift.timeSlot, dailyAvailability);
        const okCaps = canAssign(u.uid, shift.date, duration);
        const conflict = hasTimeConflict(u.uid, shift, allShiftsOnDay);
        if (banned || alreadyAssignedHere || !avail || !okCaps || !!conflict) {
          return { user: u, score: Number.NEGATIVE_INFINITY };
        }
        const weekCount = counters.weekShifts.get(u.uid) || 0;
        const fairness = -weekCount; // fewer assigned shifts get higher priority
        const p = priorities.get(u.uid) || 0;
        return { user: u, score: p + fairness };
      });

      candidateScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.user.uid.localeCompare(b.user.uid);
      });

      for (const cs of candidateScores) {
        if (remaining <= 0) break;
        if (cs.score === Number.NEGATIVE_INFINITY) continue;
        const currentRoleAssigned = shift.assignedUsers.filter(u => (users.find(x => x.uid === u.userId)?.role) === (cs.user.role)).length
          + assignments.filter(a => a.shiftId === shift.id && (users.find(x => x.uid === a.userId)?.role) === (cs.user.role)).length;
        const roleMax = maxRoleMap.get(cs.user.role) ?? Number.POSITIVE_INFINITY;
        if (currentRoleAssigned >= roleMax) continue;
        addAssignment(shift, cs.user.uid);
        remaining -= 1;
      }

      if (remaining > 0) {
        unfilled.push({ shiftId: shift.id, role, remaining });
        if (ctx.mandatoryDemand.has(`${shift.id}:${role}`)) {
          const time = `${shift.timeSlot.start}-${shift.timeSlot.end}`;
          const [y, m, d] = shift.date.split('-');
          const formattedDate = `${d}/${m}/${y}`;
          warnings.push(`Thiếu nhân sự bắt buộc cho ca ${shift.label} (${formattedDate} ${time}): còn thiếu ${remaining} người vai trò ${role}.`);
        }
      }
    }
  }

  return { assignments, unfilled, warnings };
}
