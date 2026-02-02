import type { AssignedShift, Availability, ManagedUser, ScheduleRunResult, Assignment, UserRole } from '@/lib/types';
import { normalizeConstraints, NormalizedContext } from './constraints';
import { isUserAvailable, hasTimeConflict, calculateTotalHours } from '@/lib/schedule-utils';

type Counters = {
  weekShifts: Map<string, number>; // userId -> assigned count
  weekHours: Map<string, number>; // userId -> assigned hours
  dailyShifts: Map<string, Map<string, number>>; // date -> (userId -> count)
};

const makePairKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

const isPairBlocked = (a: string, b: string, shiftId: string, ctx: NormalizedContext) => {
  const key = makePairKey(a, b);
  if (ctx.incompatibleGlobal.has(key)) return true;
  const shiftSet = ctx.incompatibleByShift.get(shiftId);
  return shiftSet?.has(key) ?? false;
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
  options?: { includeBusyUsers?: boolean; busyExclusionIds?: string[] },
): ScheduleRunResult {
  const unfilled: { shiftId: string; role: UserRole | 'Bất kỳ'; remaining: number }[] = [];
  const warnings: string[] = [];
  
  // Always ignore test accounts for scheduling
  const eligibleUsers = users.filter(u => !u.isTestAccount);
  const usersByUid = new Map(eligibleUsers.map(u => [u.uid, u]));

  // Always create new schedule (replace mode)
  const workingShifts: AssignedShift[] = shifts.map(s => ({ ...s, assignedUsers: [], assignedUsersWithRole: [] }));

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

  const addAssignment = (shift: AssignedShift, userId: string, assignedRole: UserRole | 'Bất kỳ') => {
    const duration = calculateTotalHours([shift.timeSlot]);
    counters.weekShifts.set(userId, (counters.weekShifts.get(userId) || 0) + 1);
    counters.weekHours.set(userId, (counters.weekHours.get(userId) || 0) + duration);
    const dailyMap = counters.dailyShifts.get(shift.date) || new Map<string, number>();
    dailyMap.set(userId, (dailyMap.get(userId) || 0) + 1);
    counters.dailyShifts.set(shift.date, dailyMap);

    // Keep workingShifts in sync so conflict checks see newly added assignments
    const userName = eligibleUsers.find(u => u.uid === userId)?.displayName || userId;
    shift.assignedUsersWithRole = [...(shift.assignedUsersWithRole || []), { userId, userName, assignedRole }];
    // Maintain assignedUsers for downstream consumers but do not rely on it for allocation logic
    shift.assignedUsers = (shift.assignedUsersWithRole || []).map(u => {
      const resolvedRole = u.assignedRole === 'Bất kỳ'
        ? usersByUid.get(u.userId)?.role!
        : u.assignedRole;
      return { userId: u.userId, userName: u.userName || u.userId, assignedRole: resolvedRole };
    });
  };

  // Apply forced assignments first
  for (const f of ctx.forcedAssignments) {
    const shift = workingShifts.find(s => s.id === f.shiftId);
    if (!shift) {
      warnings.push(`FORCE_MISSING_SHIFT: ${f.shiftId}`);
      continue;
    }
    const alreadyInShift = (shift.assignedUsersWithRole || []).some(u => u.userId === f.userId);
    if (alreadyInShift) continue;

    // Availability and conflict checks
    const dailyAvailability = availability.filter(a => a.date === shift.date);
    const isAvail = isUserAvailable(f.userId, shift.timeSlot, dailyAvailability);
    const conflict = hasTimeConflict(f.userId, shift, workingShifts.filter(s => s.date === shift.date));
    const pairBlocked = (shift.assignedUsersWithRole || []).some(u => isPairBlocked(u.userId, f.userId, shift.id, ctx));
    if (!isAvail) {
      if (ctx.strictAvailability) {
        continue; // Skip assignment
      }
    }
    if (conflict || pairBlocked) {
      continue; // Do not allow overlapping forced assignments
    }

    addAssignment(shift, f.userId, usersByUid.get(f.userId)?.role || 'Bất kỳ');
  }

  const fillRole = (
    shift: AssignedShift,
    needToFillRole: UserRole | 'Bất kỳ',
    matcher: (u: ManagedUser, r: UserRole | 'Bất kỳ') => boolean,
    ignoreAvailability = false
  ) => {
    const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
    const baseTarget = needToFillRole === shift.role
      ? (maxRoleMap.get(needToFillRole) ?? (shift.minUsers ?? 0))
      : (maxRoleMap.get(needToFillRole) ?? 0);
    const count = Math.max(0, baseTarget);

    const roleMax = maxRoleMap.get(needToFillRole) ?? Number.POSITIVE_INFINITY;
    const assignedFromShift = (shift.assignedUsersWithRole || []).filter(u => u.assignedRole === needToFillRole).length;

    const currentAssignedCount = assignedFromShift;
    let remaining = Math.max(0, Math.min(count, roleMax) - currentAssignedCount);
    if (remaining <= 0) return 0;

    const duration = calculateTotalHours([shift.timeSlot]);
    const dailyAvailability = availability.filter(a => a.date === shift.date);
    const allShiftsOnDay = workingShifts.filter(s => s.date === shift.date);
    const priorities = ctx.prioritiesByShift.get(shift.id) || new Map<string, number>();

    const candidates = eligibleUsers.filter(u => matcher(u, needToFillRole));

    const candidateScores = candidates.map(u => {
      const key = `${u.uid}:${shift.id}`;
      const banned = ctx.bannedPairs.has(key);
      const alreadyAssignedHere = (shift.assignedUsersWithRole || []).some(existing => existing.userId === u.uid);
      const isBusyExcluded = ignoreAvailability && options?.busyExclusionIds?.includes(u.uid);
      const avail = ignoreAvailability ? true : isUserAvailable(u.uid, shift.timeSlot, dailyAvailability);
      const okCaps = canAssign(u.uid, shift.date, duration);
      const conflict = hasTimeConflict(u.uid, shift, allShiftsOnDay);
      const pairBlocked = (shift.assignedUsersWithRole || []).some(existing => isPairBlocked(existing.userId, u.uid, shift.id, ctx));

      if (banned || alreadyAssignedHere || !avail || !okCaps || !!conflict || pairBlocked || isBusyExcluded) {
        return { user: u, score: Number.NEGATIVE_INFINITY, reason: 'ineligible' as const };
      }
      const weekCount = counters.weekShifts.get(u.uid) || 0;
      const fairness = -weekCount; // fewer assigned shifts get higher priority
      const p = priorities.get(u.uid) || 0;
      return { user: u, score: p + fairness, reason: 'eligible' as const };
    });

    candidateScores.sort((a, b) => {
      return Math.random() < 0.5 ? -1 : 1;
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.user.uid.localeCompare(b.user.uid);
    });

    for (const cs of candidateScores) {
      if (remaining <= 0) break;
      if (cs.score === Number.NEGATIVE_INFINITY) continue;
      const assignedFromShiftForCandidateRole = (shift.assignedUsersWithRole || []).filter(u => u.assignedRole === needToFillRole).length;

      const currentRoleAssigned = assignedFromShiftForCandidateRole;
      const candidateRoleMax = maxRoleMap.get(needToFillRole) ?? Number.POSITIVE_INFINITY;
      if (currentRoleAssigned >= candidateRoleMax) {
        continue;
      }
      addAssignment(shift, cs.user.uid, needToFillRole);
      remaining -= 1;
    }

    return remaining;
  };

  // Phase 1: fill using primary roles only (Available users)
  for (const shift of workingShifts) {
    const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
    const rolesToFill = new Set<UserRole | 'Bất kỳ'>([...maxRoleMap.keys() as any]);
    for (const role of rolesToFill) {
      fillRole(shift, role, mainRoleMatches);
    }
  }

  // Phase 2: attempt to backfill remaining demand with secondary roles (Available users)
  for (const shift of workingShifts) {
    const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
    const rolesToFill = new Set<UserRole | 'Bất kỳ'>([...maxRoleMap.keys() as any]);
    for (const role of rolesToFill) {
      fillRole(shift, role, secondaryRoleMatches);
    }
  }

  // Phase 3: attempt to fill remaining demand by ignoring availability (Busy users)
  if (options?.includeBusyUsers) {
    for (const shift of workingShifts) {
      const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
      const rolesToFill = new Set<UserRole | 'Bất kỳ'>([...maxRoleMap.keys() as any]);
      for (const role of rolesToFill) {
        // Try primary roles for busy users
        fillRole(shift, role, mainRoleMatches, true);
        // Try secondary roles for busy users
        fillRole(shift, role, secondaryRoleMatches, true);
      }
    }
  }

  // Reporting Phase: Calculate unfilled demand and generate warnings
  for (const shift of workingShifts) {
    const maxRoleMap = ctx.maxByShiftRole.get(shift.id) || new Map<UserRole | 'Bất kỳ', number>();
    const rolesToFill = new Set<UserRole | 'Bất kỳ'>([...maxRoleMap.keys() as any]);
    for (const role of rolesToFill) {
      const target = role === shift.role
        ? (maxRoleMap.get(role) ?? (shift.minUsers ?? 0))
        : (maxRoleMap.get(role) ?? 0);
      
      const assignedFromShift = (shift.assignedUsersWithRole || []).filter(u => u.assignedRole === role).length;
      const remaining = Math.max(0, target - assignedFromShift);

      if (remaining > 0) {
        unfilled.push({ shiftId: shift.id, role, remaining });
        const mandatoryKeys = [
          `${shift.id}:${role}`,
          `${shift.id}:primary:${role}`,
          `${shift.id}:secondary:${role}`,
        ];
        const isMandatory = mandatoryKeys.some(k => ctx.mandatoryDemand.has(k));
        const time = `${shift.timeSlot.start}-${shift.timeSlot.end}`;
        const [y, m, d] = shift.date.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        if (isMandatory) {
          const msg = `Thiếu nhân sự bắt buộc cho ca ${shift.label} (${formattedDate} ${time}): còn thiếu ${remaining} người vai trò ${role}.`;
          warnings.push(msg);
        }
      }
    }
  }

  // Build assignments array from the authoritative shift.assignedUsers list
  const assignments: Assignment[] = workingShifts.flatMap(shift =>
    (shift.assignedUsersWithRole || []).map(u => ({ shiftId: shift.id, role: u.assignedRole, userId: u.userId }))
  );

  return { assignments, unfilled, warnings };
}
