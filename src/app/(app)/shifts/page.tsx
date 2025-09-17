

'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset, ShieldX, CalendarDays, Loader2, Info, Archive, ClipboardList } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { dataStore } from '@/lib/data-store';
import type { Schedule, AssignedShift } from '@/lib/types';
import { getISOWeek, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Define the main shift time frames
const mainShiftFrames: { [key: string]: { start: string; end: string } } = {
  sang: { start: '05:30', end: '11:59' },
  trua: { start: '12:00', end: '16:59' },
  toi: { start: '17:00', end: '22:30' },
};

const mainShiftInfo = {
    sang: { name: "Ca Sáng", icon: Sun, href: "/checklist/sang" },
    trua: { name: "Ca Trưa", icon: Sunset, href: "/checklist/trua" },
    toi: { name: "Ca Tối", icon: Moon, href: "/checklist/toi" },
}

function BartenderDashboard() {
  return (
    <Card className="mt-8">
        <CardHeader>
          <CardTitle>Bảng điều khiển Pha chế (Phụ)</CardTitle>
          <CardDescription>Truy cập các tính năng của vai trò phụ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
           <Button asChild size="lg" variant="outline">
            <Link href="/bartender/hygiene-report">
              <ClipboardList className="mr-2" />
              Báo cáo Vệ sinh quầy
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/bartender/inventory">
              <Archive className="mr-2" />
              Kiểm kê Tồn kho
            </Link>
          </Button>
        </CardContent>
      </Card>
  )
}

export default function ShiftsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const weekId = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-W${getISOWeek(today)}`;
  }, []);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'Phục vụ') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      const unsub = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
        setSchedule(newSchedule);
        setIsLoading(false);
      });
      return () => unsub();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, weekId, authLoading]);

  const todaysShifts = useMemo((): AssignedShift[] => {
    if (!schedule || !schedule.shifts || schedule.status !== 'published') {
      return [];
    }
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    return schedule.shifts
        .filter(shift => shift.date === todayKey && shift.assignedUsers.some(u => u.userId === user?.uid))
        .sort((a,b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
  }, [schedule, user]);

  const relevantMainShifts = useMemo((): string[] => {
    if (todaysShifts.length === 0) return [];

    const mainShifts = new Set<string>();

    todaysShifts.forEach(shift => {
        const shiftStart = shift.timeSlot.start;
        for (const key in mainShiftFrames) {
            if (shiftStart >= mainShiftFrames[key].start && shiftStart <= mainShiftFrames[key].end) {
                mainShifts.add(key);
            }
        }
    });

    return Array.from(mainShifts);
  }, [todaysShifts]);
  
  const hasBartenderSecondaryRole = user?.secondaryRoles?.includes('Pha chế');


  if (authLoading || isLoading) {
    return (
       <div className="flex min-h-full items-center justify-center p-4">
         <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Đang tìm ca làm việc của bạn...</p>
         </div>
      </div>
    )
  }

  if (!user) {
    // This should ideally not happen due to the auth hook, but as a fallback.
    return (
       <div className="flex min-h-full items-center justify-center">
         <p>Vui lòng đăng nhập.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Bảng điều khiển Phục vụ</CardTitle>
            <CardDescription>
              {todaysShifts.length > 0
                ? `Hôm nay bạn có ca: ${todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ')}`
                : "Bạn không có ca làm việc hôm nay."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
              {relevantMainShifts.length > 0 ? (
                  Object.entries(mainShiftInfo).map(([key, info]) => {
                      if (relevantMainShifts.includes(key)) {
                          const Icon = info.icon;
                          return (
                              <Button asChild size="lg" key={key}>
                                  <Link href={info.href}>
                                      <Icon className="mr-2" />
                                      {info.name}
                                  </Link>
                              </Button>
                          )
                      }
                      return null;
                  })
              ) : (
                  <div className="flex items-center justify-center p-4 rounded-md bg-muted text-muted-foreground text-sm gap-2">
                      <Info className="h-4 w-4" />
                      <span>Không có checklist công việc nào cho hôm nay.</span>
                  </div>
              )}

            <Separator className="my-2" />
            <Button asChild size="lg" variant="outline">
              <Link href="/schedule">
                  <CalendarDays className="mr-2" />
                  Lịch làm việc
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/violations">
                  <ShieldX className="mr-2" />
                  Danh sách Vi phạm
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        {hasBartenderSecondaryRole && <BartenderDashboard />}
      </div>
    </div>
  );
}
