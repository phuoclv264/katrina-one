import { differenceInDays } from 'date-fns';
import type { ManagedUser } from './types';

export const ACTIVE_EMPLOYMENT_STATUS = 'Đang làm việc';
export const RESIGNED_EMPLOYMENT_STATUS = 'Nghỉ việc';
export const NEW_STAFF_PERIOD_DAYS = 30;

export function isNewStaff(user?: Partial<ManagedUser> | null, withinDays = NEW_STAFF_PERIOD_DAYS): boolean {
  if (!user?.registeredAt) return false;
  const registeredDate = new Date(user.registeredAt);
  if (Number.isNaN(registeredDate.getTime())) return false;
  return differenceInDays(new Date(), registeredDate) < withinDays;
}

export function getEmploymentStatus(user?: Partial<ManagedUser> | null): string {
  return user?.employmentStatus ?? ACTIVE_EMPLOYMENT_STATUS;
}

export function isResignedUser(user?: Partial<ManagedUser> | null): boolean {
  return getEmploymentStatus(user) === RESIGNED_EMPLOYMENT_STATUS;
}

export function isActiveUser(user?: Partial<ManagedUser> | null): boolean {
  return !isResignedUser(user);
}

export function isTestAccount(user?: Partial<ManagedUser> | null): boolean {
  return user?.isTestAccount === true;
}
