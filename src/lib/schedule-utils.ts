

import type { TimeSlot, Availability, AssignedShift } from './types';

/**
 * Checks if a user is available for a given shift time slot.
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

  // Check if any of the user's available slots contain the entire shift duration.
  return userAvailability.availableSlots.some(availableSlot => {
    const availableStart = parseTime(availableSlot.start);
    const availableEnd = parseTime(availableSlot.end);
    
    return availableStart <= shiftStart && availableEnd >= shiftEnd;
  });
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
