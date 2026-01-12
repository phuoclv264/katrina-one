'use client';

import type { MediaAttachment, ShiftBusyEvidence, ManagedUser, UserRole, AssignedShift, Schedule, BusyReportRequest } from '@/lib/types';
import type { AuthUser } from '@/hooks/use-auth';

// Return eligible users for a shift and which of them have not yet submitted evidence
// Also compute per-role eligible/pending and the list of pending users that are actually needed to fill missing slots
export function getEligibleAndPendingUsers(
  shift: AssignedShift,
  allUsers: ManagedUser[],
  shiftEvidences: ShiftBusyEvidence[],
  busyRequest?: BusyReportRequest
) {
  const reqs = shift.requiredRoles || [];
  const submittedIds = new Set(shiftEvidences.map(e => e.submittedBy.userId));

  // Per-role breakdown when requiredRoles are present
  let perRole = reqs.map((req) => {
    const assignedOfRole = shift.assignedUsers.filter((au) => {
      const user = allUsers.find((u) => u.uid === au.userId);
      const effRole = au.assignedRole ?? user?.role;
      return effRole === req.role;
    }).length;

    const missing = Math.max(0, req.count - assignedOfRole);
    const eligible = allUsers.filter(u => userMatchesRole(u, req.role));
    const pending = eligible.filter(u => !submittedIds.has(u.uid));

    return { role: req.role, missing, eligible, pending };
  });

  // Aggregate lists
  let eligibleUsers = reqs.length > 0
    ? Array.from(new Map(perRole.filter(p => p.missing > 0).flatMap(p => p.eligible).map(u => [u.uid, u])).values())
    : allUsers.filter(user => userMatchesRole(user, shift.role));

  let pendingUsers = (reqs.length > 0
    ? Array.from(new Map(perRole.filter(p => p.missing > 0).flatMap(p => p.pending).map(u => [u.uid, u])).values())
    : eligibleUsers.filter(u => !submittedIds.has(u.uid)));


  // If an owner has set up a BusyReportRequest for this shift, narrow down eligible/pending users accordingly
  if (busyRequest && busyRequest.active) {
    if (busyRequest.targetMode === 'roles') {
      const roles = new Set(busyRequest.targetRoles || []);
      // Filter per-role breakdown and aggregate lists
      eligibleUsers = allUsers.filter(u => roles.has(u.role));
    } else if (busyRequest.targetMode === 'users') {
      const ids = new Set(busyRequest.targetUserIds || []);
      eligibleUsers = allUsers.filter(u => ids.has(u.uid));
    } else { // targetMode === 'all'
      eligibleUsers = allUsers;
    }

    pendingUsers = eligibleUsers.filter(u => !submittedIds.has(u.uid));
  }

  return { eligibleUsers, pendingUsers };
}

type Options = {
  currentUser?: AuthUser | null;
  roleAware?: boolean; // if true, filter shifts relevant to currentUser's roles; if false, return all understaffed shifts
};

export function getRelevantUnderstaffedShifts(
  schedule: Schedule | null,
  allUsers: ManagedUser[],
  options: Options = {}
): AssignedShift[] {
  const { currentUser = null, roleAware = true } = options;
  if (!schedule) return [];

  // Preserve previous behavior: when roleAware is enabled, if there is no current user or the current user is the Owner, return []
  if (roleAware) {
    if (!currentUser || currentUser.role === 'Chủ nhà hàng') return [];
  }

  const allowedRoles = new Set<UserRole>(
    currentUser ? [currentUser.role, ...(currentUser.secondaryRoles || [])] : []
  );

  return schedule.shifts.filter((shift) => {
    const minUsers = shift.minUsers ?? 0;
    const lackingMin = minUsers > 0 && shift.assignedUsers.length < minUsers;

    const reqs = shift.requiredRoles || [];

    // compute which required roles are currently understaffed
    const lackingReqRoles = reqs.filter((req) => {
      const assignedOfRole = shift.assignedUsers.filter((au) => {
        const user = allUsers.find((u) => u.uid === au.userId);
        const effRole = au.assignedRole ?? user?.role;
        return effRole === req.role;
      }).length;
      return assignedOfRole < req.count;
    });

    // If specific role requirements exist, we only consider 'needsStaff' when one of those roles is lacking.
    // Otherwise, we fall back to the generic minUsers check.
    // const needsStaff = reqs.length > 0 ? (lackingReqRoles.length > 0 && lackingMin) : lackingMin;
    const needsStaff = reqs.length > 0 && lackingReqRoles.length > 0;
    if (!needsStaff) return false;

    // If role-aware filtering is requested, only show shifts relevant to the current user's role(s)
    if (roleAware) {
      if (reqs.length > 0) {
        return lackingReqRoles.some((r) => allowedRoles.has(r.role));
      }

      if (shift.role === 'Bất kỳ') {
        return currentUser!.role !== 'Chủ nhà hàng';
      }

      return allowedRoles.has(shift.role as UserRole);
    }

    // roleAware disabled -> include all understaffed shifts
    return true;
  });
}

// Compute per-role missing counts and a friendly display text for a shift
export function getShiftMissingDetails(shift: AssignedShift, allUsers: ManagedUser[]) {
  const reqs = shift.requiredRoles || [];
  const missingByRole = reqs.map((req) => {
    const assignedOfRole = shift.assignedUsers.filter((au) => {
      const user = allUsers.find((u) => u.uid === au.userId);
      const effRole = au.assignedRole ?? user?.role;
      return effRole === req.role;
    }).length;
    return { role: req.role, missing: Math.max(0, req.count - assignedOfRole) };
  });

  const totalRoleMissing = missingByRole.reduce((s, r) => s + r.missing, 0);
  const totalMissing = totalRoleMissing > 0 ? totalRoleMissing : Math.max(0, (shift.minUsers ?? 0) - shift.assignedUsers.length);

  const roleText = missingByRole.filter(m => m.missing > 0).map(m => `${m.missing} ${m.role}`).join(', ');
  const text = roleText.length > 0 ? `Thiếu ${roleText}` : `Thiếu ${totalMissing} người`;

  return {
    perRole: missingByRole,
    totalMissing,
    text,
  };
}

export const getRoleColor = (role: UserRole | 'Bất kỳ'): string => {
  switch (role) {
    case 'Phục vụ':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
    case 'Pha chế':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    case 'Thu ngân':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
    case 'Quản lý':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
  }
};

export const userMatchesRole = (user: ManagedUser, role: UserRole | 'Bất kỳ') => {
  if (role === 'Bất kỳ') {
    return user.role !== 'Chủ nhà hàng';
  }
  return user.role === role || (user.secondaryRoles || []).includes(role);
};

export const toDate = (value: ShiftBusyEvidence['submittedAt']) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const maybeTimestamp = value as { toDate?: () => Date } | null;
  if (maybeTimestamp?.toDate) {
    try {
      return maybeTimestamp.toDate();
    } catch (error) {
      console.warn('Failed to convert timestamp to date', error);
      return null;
    }
  }
  return null;
};

export const buildSlides = (media: MediaAttachment[]) =>
  media.map((attachment) => {
    if (attachment.type === 'video') {
      return {
        type: 'video' as const,
        sources: [
          { src: attachment.url, type: 'video/mp4' },
          { src: attachment.url, type: 'video/webm' },
        ],
      };
    }
    return { src: attachment.url };
  });
