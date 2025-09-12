
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { Schedule, ManagedUser } from '@/lib/types';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TotalHoursTrackerProps = {
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  onUserClick: (user: ManagedUser) => void;
};

export default function TotalHoursTracker({ schedule, allUsers, onUserClick }: TotalHoursTrackerProps) {

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

  const availableHoursByUser = useMemo(() => {
    if (!schedule?.availability) return new Map<string, number>();

    const hoursMap = new Map<string, number>();
    schedule.availability.forEach(avail => {
        const userHours = calculateTotalHours(avail.availableSlots);
        hoursMap.set(avail.userId, (hoursMap.get(avail.userId) || 0) + userHours);
    });
    return hoursMap;
  }, [schedule?.availability]);
  
  const sortedUsers = useMemo(() => {
    const activeUsers = allUsers.filter(u => u.role !== 'Chủ nhà hàng');
    return activeUsers.sort((a,b) => {
        const hoursA = totalHoursByUser.get(a.uid) || 0;
        const hoursB = totalHoursByUser.get(b.uid) || 0;
        return hoursB - hoursA;
    })
  }, [allUsers, totalHoursByUser]);

  const maxHours = useMemo(() => {
    const allHours = Array.from(totalHoursByUser.values()).concat(Array.from(availableHoursByUser.values()));
    if (allHours.length === 0) return 40;
    return Math.max(...allHours, 40);
  }, [totalHoursByUser, availableHoursByUser]);


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
      <CardContent className="space-y-2">
        {sortedUsers.map(user => {
            const workedHours = totalHoursByUser.get(user.uid) || 0;
            const availableHours = availableHoursByUser.get(user.uid) || 0;
            const progressValue = availableHours > 0 ? (workedHours / availableHours) * 100 : 0;
            
            return (
                <Button 
                    key={user.uid}
                    variant="ghost"
                    className="w-full h-auto p-2 text-left"
                    onClick={() => onUserClick(user)}
                >
                    <div className="w-full">
                        <div className="flex justify-between mb-1 text-sm">
                            <span className="font-medium">{user.displayName}</span>
                            <span className="text-muted-foreground">
                                {workedHours.toFixed(1)} / {availableHours.toFixed(1)} giờ
                            </span>
                        </div>
                        <Progress value={progressValue} aria-label={`${user.displayName} total hours`} />
                    </div>
                </Button>
            )
        })}
        {sortedUsers.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-4">Chưa có nhân viên nào.</p>
        )}
      </CardContent>
    </Card>
  );
}
