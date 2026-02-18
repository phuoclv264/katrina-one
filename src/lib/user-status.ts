import type { ManagedUser } from './types';

export const ACTIVE_EMPLOYMENT_STATUS = 'Đang làm việc';
export const RESIGNED_EMPLOYMENT_STATUS = 'Nghỉ việc';

export function getEmploymentStatus(user?: Partial<ManagedUser> | null): string {
  return user?.employmentStatus ?? ACTIVE_EMPLOYMENT_STATUS;
}

export function isResignedUser(user?: Partial<ManagedUser> | null): boolean {
  return getEmploymentStatus(user) === RESIGNED_EMPLOYMENT_STATUS;
}

export function isActiveUser(user?: Partial<ManagedUser> | null): boolean {
  return !isResignedUser(user);
}
