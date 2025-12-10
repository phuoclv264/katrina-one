import type { ManagedUser, AssignedShift, Availability, ScheduleCondition } from '@/lib/types';
import { schedule } from '@/lib/scheduler';

function makeUser(id: string, displayName: string, role: ManagedUser['role']): ManagedUser {
  return { uid: id, email: `${id}@example.com`, displayName, role } as ManagedUser;
}

function makeShift(id: string, date: string, label: string, role: ManagedUser['role'], start: string, end: string, minUsers = 1): AssignedShift {
  return { id, templateId: `t_${id}`, date, label, role, timeSlot: { start, end }, assignedUsers: [], minUsers };
}

function makeAvail(userId: string, userName: string, date: string, slots: { start: string; end: string }[]): Availability {
  return { userId, userName, date, availableSlots: slots } as Availability;
}

export function runExampleTests() {
  const users: ManagedUser[] = [
    makeUser('u1', 'A User', 'Phục vụ'),
    makeUser('u2', 'B User', 'Phục vụ'),
  ];
  const shifts: AssignedShift[] = [
    makeShift('s1', '2025-01-06', 'Sáng', 'Phục vụ', '08:00', '12:00', 2),
  ];
  const availability: Availability[] = [
    makeAvail('u1', 'A User', '2025-01-06', [{ start: '07:00', end: '13:00' }]),
    makeAvail('u2', 'B User', '2025-01-06', [{ start: '07:00', end: '13:00' }]),
  ];
  const constraints: ScheduleCondition[] = [];

  const result = schedule(shifts, users, availability, constraints);

  const filled = result.unfilled.reduce((sum, u) => sum + u.remaining, 0) === 0;
  const assignedCount = result.assignments.length === 2;
  return { filled, assignedCount, warnings: result.warnings };
}
