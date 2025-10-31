import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './use-auth';
import { dataStore } from '@/lib/data-store';

export function useCheckInCardPlacement() {
  const { user, isOnActiveShift, activeShifts } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  useEffect(() => {
    if (user) {
      const unsub = dataStore.subscribeToUserCheckInStatus(user.uid, (status) => {
        setIsCheckedIn(status);
      });
      return () => unsub();
    }
  }, [user]);

  const showCheckInCardOnTop = useMemo(() => {
    // Condition 1: User is in an active shift but hasn't checked in yet.
    const shouldShowForCheckIn = isOnActiveShift && !isCheckedIn;
    if (shouldShowForCheckIn) {
      return true;
    }

    // Condition 2: User is checked in and it's near the end of their last active shift.
    if (isCheckedIn && activeShifts.length > 0) {
      const now = new Date();
      
      // Find the latest end time among all currently active shifts
      const lastShiftEndTime = activeShifts.reduce((latestEnd, shift) => {
        const [endHour, endMinute] = shift.timeSlot.end.split(':').map(Number);
        const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
        return shiftEnd > latestEnd ? shiftEnd : latestEnd;
      }, new Date(0));

      // Show the card if it's within 5 minutes of the final shift's end time and up to 60 minutes after.
      return now.getTime() >= lastShiftEndTime.getTime() - 5 * 60 * 1000
              && now.getTime() < lastShiftEndTime.getTime() + 60 * 60 * 1000;
    }

    return false;
  }, [isOnActiveShift, isCheckedIn, activeShifts]);

  return { showCheckInCardOnTop, isCheckedIn };
}