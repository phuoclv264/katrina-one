import type { ScheduleCondition, WorkloadLimit, DailyShiftLimit, StaffShiftLink, ShiftStaffing, StaffPriority, AvailabilityStrictness } from '@/lib/types';
import type { AssignedShift, ManagedUser, UserRole } from '@/lib/types';

export type UserCaps = {
  minShiftsPerWeek: number;
  maxShiftsPerWeek: number;
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  maxPerDay: number;
};

export type NormalizedContext = {
  maxByShiftRole: Map<string, Map<UserRole | 'Bất kỳ', number>>;
  prioritiesByShift: Map<string, Map<string, number>>; // shiftId -> userId -> weight
  forcedAssignments: { userId: string; shiftId: string }[];
  bannedPairs: Set<string>; // `${userId}:${shiftId}`
  capsByUser: Map<string, UserCaps>;
  mandatoryDemand: Set<string>;
  strictAvailability: boolean;
};

const defaultCaps: UserCaps = {
  minShiftsPerWeek: 0,
  maxShiftsPerWeek: Number.POSITIVE_INFINITY,
  minHoursPerWeek: 0,
  maxHoursPerWeek: Number.POSITIVE_INFINITY,
  maxPerDay: Number.POSITIVE_INFINITY,
};

export function normalizeConstraints(
  constraints: ScheduleCondition[],
  shifts: AssignedShift[],
  users: ManagedUser[],
): NormalizedContext {
  const prioritiesByShift = new Map<string, Map<string, number>>();
  const maxByShiftRole = new Map<string, Map<UserRole | 'Bất kỳ', number>>();
  const forcedAssignments: { userId: string; shiftId: string }[] = [];
  const bannedPairs = new Set<string>();
  const capsByUser = new Map<string, UserCaps>();
  const mandatoryDemand = new Set<string>();

  // Global workload defaults
  let globalWorkload: WorkloadLimit | null = null;
  let globalDailyLimit: DailyShiftLimit | null = null;
  let availabilityStrictness: AvailabilityStrictness | null = null;

  // Gather globals first
  for (const c of constraints) {
    if (!c.enabled) continue;
    if (c.type === 'WorkloadLimit' && c.scope === 'global') {
      globalWorkload = c as WorkloadLimit;
    } else if (c.type === 'DailyShiftLimit' && !c.userId) {
      globalDailyLimit = c as DailyShiftLimit;
    } else if (c.type === 'AvailabilityStrictness') {
      availabilityStrictness = c as AvailabilityStrictness;
    }
  }

  // Initialize caps per user from global
  for (const u of users) {
    const caps: UserCaps = { ...defaultCaps };
    if (globalWorkload) {
      caps.minShiftsPerWeek = globalWorkload.minShiftsPerWeek ?? caps.minShiftsPerWeek;
      caps.maxShiftsPerWeek = globalWorkload.maxShiftsPerWeek ?? caps.maxShiftsPerWeek;
      caps.minHoursPerWeek = globalWorkload.minHoursPerWeek ?? caps.minHoursPerWeek;
      caps.maxHoursPerWeek = globalWorkload.maxHoursPerWeek ?? caps.maxHoursPerWeek;
    }
    if (globalDailyLimit) {
      caps.maxPerDay = globalDailyLimit.maxPerDay ?? caps.maxPerDay;
    }
    capsByUser.set(u.uid, caps);
  }

  // Apply specific caps overriding global
  for (const c of constraints) {
    if (!c.enabled) continue;
    if (c.type === 'WorkloadLimit' && c.scope === 'user' && c.userId) {
      const caps = capsByUser.get(c.userId) || { ...defaultCaps };
      const wl = c as WorkloadLimit;
      caps.minShiftsPerWeek = wl.minShiftsPerWeek ?? caps.minShiftsPerWeek;
      caps.maxShiftsPerWeek = wl.maxShiftsPerWeek ?? caps.maxShiftsPerWeek;
      caps.minHoursPerWeek = wl.minHoursPerWeek ?? caps.minHoursPerWeek;
      caps.maxHoursPerWeek = wl.maxHoursPerWeek ?? caps.maxHoursPerWeek;
      capsByUser.set(c.userId, caps);
    } else if (c.type === 'DailyShiftLimit' && c.userId) {
      const caps = capsByUser.get(c.userId) || { ...defaultCaps };
      const dl = c as DailyShiftLimit;
      caps.maxPerDay = dl.maxPerDay ?? caps.maxPerDay;
      capsByUser.set(c.userId, caps);
    }
  }

  // Demand and links/priorities
  for (const c of constraints) {
    if (!c.enabled) continue;
    if (c.type === 'ShiftStaffing') {
      const ss = c as ShiftStaffing;
      if (ss.templateId) {
        const targetShifts = shifts.filter(s => s.templateId === ss.templateId);
        for (const sh of targetShifts) {
          const maxRoleMap = maxByShiftRole.get(sh.id) || new Map<UserRole | 'Bất kỳ', number>();
          maxRoleMap.set(ss.role, Math.max(0, ss.count));
          maxByShiftRole.set(sh.id, maxRoleMap);
          if (ss.mandatory) mandatoryDemand.add(`${sh.id}:${ss.role}`);
        }
      }
    } else if (c.type === 'StaffShiftLink') {
      const link = c as StaffShiftLink;
      const targetShifts = shifts.filter(s => s.templateId === link.templateId);
      for (const sh of targetShifts) {
        const key = `${link.userId}:${sh.id}`;
        if (link.link === 'force') {
          forcedAssignments.push({ userId: link.userId, shiftId: sh.id });
        } else {
          bannedPairs.add(key);
        }
      }
    } else if (c.type === 'StaffPriority') {
      const sp = c as StaffPriority;
      if (sp.templateId) {
        const targetShifts = shifts.filter(s => s.templateId === sp.templateId);
        for (const sh of targetShifts) {
          const map = prioritiesByShift.get(sh.id) || new Map<string, number>();
          const base = (sp.weight ?? 0);
          map.set(sp.userId, sp.mandatory ? base + 100 : base);
          prioritiesByShift.set(sh.id, map);
        }
      }
    }
  }

  return { maxByShiftRole, prioritiesByShift, forcedAssignments, bannedPairs, capsByUser, mandatoryDemand, strictAvailability: availabilityStrictness?.strict ?? false };
}
