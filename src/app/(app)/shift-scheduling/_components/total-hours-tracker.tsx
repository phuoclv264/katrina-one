
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { Schedule, ManagedUser } from '@/lib/types';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Users } from 'lucide-react';

type TotalHoursTrackerProps = {
  schedule: Schedule | null;
  allUsers: ManagedUser[];
};

export default function TotalHoursTracker({ schedule, allUsers }: TotalHoursTrackerProps) {

  const totalHoursByUser = useMemo(() => {
    if (!schedule) return new Map<string, number>();

    const hoursMap = new Map<string, number>();
    schedule.shifts.forEach(shift => {
      const shiftDuration = calculateTotalHours([shift.timeSlot]);
      shift.assignedUsers.forEach(user => {
        hoursMap.set(user.userId, (hoursMap.get(user.userId) || 0) + shiftDuration);
      });
    });
    return hoursMap;
  }, [schedule]);
  
  const sortedUsers = useMemo(() => {
    const activeUsers = allUsers.filter(u => u.role !== 'Chủ nhà hàng');
    return activeUsers.sort((a,b) => {
        const hoursA = totalHoursByUser.get(a.uid) || 0;
        const hoursB = totalHoursByUser.get(b.uid) || 0;
        return hoursB - hoursA;
    })
  }, [allUsers, totalHoursByUser]);

  const maxHours = useMemo(() => {
    const hours = Array.from(totalHoursByUser.values());
    if (hours.length === 0) return 40; // Default max if no one is scheduled
    return Math.max(...hours, 40);
  }, [totalHoursByUser]);

  if (!schedule) {
      return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
                 <Skeleton className="h-8 w-full" />
                 <Skeleton className="h-8 w-full" />
                 <Skeleton className="h-8 w-full" />
            </CardContent>
        </Card>
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users /> Tổng giờ làm trong tuần</CardTitle>
        <CardDescription>
          Số giờ làm dự kiến của mỗi nhân viên dựa trên lịch đã xếp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedUsers.map(user => {
            const hours = totalHoursByUser.get(user.uid) || 0;
            const progressValue = (hours / maxHours) * 100;
            return (
                <div key={user.uid}>
                    <div className="flex justify-between mb-1 text-sm">
                        <span className="font-medium">{user.displayName}</span>
                        <span className="text-muted-foreground">{hours.toFixed(1)} giờ</span>
                    </div>
                    <Progress value={progressValue} aria-label={`${user.displayName} total hours`} />
                </div>
            )
        })}
        {sortedUsers.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-4">Chưa có nhân viên nào.</p>
        )}
      </CardContent>
    </Card>
  );
}
