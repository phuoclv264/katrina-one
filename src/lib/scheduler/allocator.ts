import type { AssignedShift, Availability, ManagedUser, ScheduleRunResult, Assignment, UserRole } from '@/lib/types';
import { normalizeConstraints, NormalizedContext } from './constraints';
import { isUserAvailable, hasTimeConflict, calculateTotalHours } from '@/lib/schedule-utils';

type Counters = {
  weekShifts: Map<string, number>; // userId -> assigned count
  weekHours: Map<string, number>; // userId -> assigned hours
  dailyShifts: Map<string, Map<string, number>>; // date -> (userId -> count)
};

function initCounters(): Counters {
  // Always start with empty counters (replace mode)
  return {
    weekShifts: new Map<string, number>(),
    weekHours: new Map<string, number>(),
    dailyShifts: new Map<string, Map<string, number>>(),
  };
}

function mainRoleMatches(user: ManagedUser, role: UserRole | 'Bất kỳ'): boolean {
  if (role === 'Bất kỳ') return true;
  return user.role === role;
}

function secondaryRoleMatches(user: ManagedUser, role: UserRole | 'Bất kỳ'): boolean {
  if (role === 'Bất kỳ') return true;
  return user.secondaryRoles?.includes(role) ?? false;
}

export function allocate(
  shifts: AssignedShift[],
  users: ManagedUser[],
  availability: Availability[],
  ctx: NormalizedContext,
): ScheduleRunResult {
  const unfilled: { shiftId: string; role: UserRole | 'Bất kỳ'; remaining: number }[] = [];
  const warnings: string[] = [];

  // Always create new schedule (replace mode)
  const workingShifts: AssignedShift[] = shifts.map(s => ({ ...s, assignedUsers: [] }));

  const counters = initCounters();

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
        continue; // Skip assignment
      }
    }
    if (conflict) {
      continue; // Do not allow overlapping forced assignments
    }

    addAssignment(shift, f.userId);
  }

  const usersByUid = new Map(users.map(u => [u.uid, u]));

  // Allocate demand
  for (const shift of workingShifts) {
    const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
    const rolesToFill = new Set<UserRole | 'Bất kỳ'>([...maxRoleMap.keys() as any]);
    for (const role of rolesToFill) {
      const baseTarget = role === shift.role
        ? (maxRoleMap.get(role) ?? (shift.minUsers ?? 0))
        : (maxRoleMap.get(role) ?? 0);
      const count = Math.max(0, baseTarget);

      const roleMax = maxRoleMap.get(role) ?? Number.POSITIVE_INFINITY;

      const fillRole = (
        matcher: (u: ManagedUser, r: UserRole | 'Bất kỳ') => boolean,
        phaseLabel: 'primary' | 'secondary'
      ) => {
        const assignedFromShift = shift.assignedUsers.filter(u => {
          const user = usersByUid.get(u.userId);
          return user && matcher(user, role);
        }).length;

        const currentAssignedCount = assignedFromShift;
        let remaining = Math.max(0, Math.min(count, roleMax) - currentAssignedCount);
        if (remaining <= 0) return 0;

        const duration = calculateTotalHours([shift.timeSlot]);
        const dailyAvailability = availability.filter(a => a.date === shift.date);
        const allShiftsOnDay = workingShifts.filter(s => s.date === shift.date);
        const priorities = ctx.prioritiesByShift.get(shift.id) || new Map<string, number>();

        const candidates = users.filter(u => matcher(u, role));

        const candidateScores = candidates.map(u => {
          const key = `${u.uid}:${shift.id}`;
          const banned = ctx.bannedPairs.has(key);
          const alreadyAssignedHere = shift.assignedUsers.some(x => x.userId === u.uid);
          const avail = isUserAvailable(u.uid, shift.timeSlot, dailyAvailability);
          const okCaps = canAssign(u.uid, shift.date, duration);
          const conflict = hasTimeConflict(u.uid, shift, allShiftsOnDay);

          if (banned || alreadyAssignedHere || !avail || !okCaps || !!conflict) {
            return { user: u, score: Number.NEGATIVE_INFINITY, reason: 'ineligible' as const };
          }
          const weekCount = counters.weekShifts.get(u.uid) || 0;
          const fairness = -weekCount; // fewer assigned shifts get higher priority
          const p = priorities.get(u.uid) || 0;
          return { user: u, score: p + fairness, reason: 'eligible' as const };
        });

        candidateScores.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.user.uid.localeCompare(b.user.uid);
        });

        for (const cs of candidateScores) {
          if (remaining <= 0) break;
          if (cs.score === Number.NEGATIVE_INFINITY) continue;
          const assignedFromShiftForCandidateRole = shift.assignedUsers.filter(u => {
            const user = usersByUid.get(u.userId);
            return user && user.role === cs.user.role;
          }).length;

          const currentRoleAssigned = assignedFromShiftForCandidateRole;
          const candidateRoleMax = maxRoleMap.get(cs.user.role) ?? Number.POSITIVE_INFINITY;
          if (currentRoleAssigned >= candidateRoleMax) {
            continue;
          }
          addAssignment(shift, cs.user.uid);
          remaining -= 1;
        }

        return remaining;
      };

      // Primary pass: match main role
      const remainingAfterPrimary = fillRole(mainRoleMatches, 'primary');

      // Secondary pass: only if still lacking
      if (remainingAfterPrimary > 0) {
        const remainingAfterSecondary = fillRole(secondaryRoleMatches, 'secondary');
        if (remainingAfterSecondary > 0) {
          unfilled.push({ shiftId: shift.id, role, remaining: remainingAfterSecondary });
            const mandatoryKeys = [
            `${shift.id}:${role}`,
            `${shift.id}:primary:${role}`,
            `${shift.id}:secondary:${role}`,
            ];
            const isMandatory = mandatoryKeys.some(k => ctx.mandatoryDemand.has(k));
            if (isMandatory) {
            const time = `${shift.timeSlot.start}-${shift.timeSlot.end}`;
            const [y, m, d] = shift.date.split('-');
            const formattedDate = `${d}/${m}/${y}`;
            warnings.push(`Thiếu nhân sự bắt buộc cho ca ${shift.label} (${formattedDate} ${time}): còn thiếu ${remainingAfterSecondary} người vai trò ${role}.`);
            }
        }
      }
    }
  }

  // Build assignments array from the authoritative shift.assignedUsers list
  const assignments: Assignment[] = workingShifts.flatMap(shift =>
    shift.assignedUsers.map(u => ({ shiftId: shift.id, role: shift.role, userId: u.userId }))
  );

  return { assignments, unfilled, warnings };
}
