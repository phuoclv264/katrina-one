import type { AssignedShift, Availability, ManagedUser, ScheduleCondition, ScheduleRunResult } from '@/lib/types';
import { normalizeConstraints } from './constraints';
import { allocate } from './allocator';

export function schedule(
  shifts: AssignedShift[],
  users: ManagedUser[],
  availability: Availability[],
  constraints: ScheduleCondition[],
  options?: { includeBusyUsers?: boolean; busyExclusionIds?: string[] },
): ScheduleRunResult {
  const ctx = normalizeConstraints(constraints, shifts, users);
  return allocate(shifts, users, availability, ctx, options);
}
