
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { isUserOnActiveShift } from '@/lib/schedule-utils';
import type { AssignedShift, Schedule } from '@/lib/types';
import { format, getISOWeek } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

type WorkShiftGuardProps = {
  children: React.ReactNode;
  redirectPath: string;
};

export default function WorkShiftGuard({ children, redirectPath }: WorkShiftGuardProps) {
  const { user, loading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);

  const weekId = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-W${getISOWeek(today)}`;
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user) {
      return;
    }

    let isMounted = true;

    const checkShift = async () => {
      try {
        const schedule: Schedule | null = await dataStore.getSchedule(weekId);
        
        if (!schedule || schedule.status !== 'published') {
          if (isMounted) setCanAccess(false);
          return;
        }

        const todayKey = format(new Date(), 'yyyy-MM-dd');
        const todaysShifts: AssignedShift[] = schedule.shifts
          .filter(shift => shift.date === todayKey && shift.assignedUsers.some(u => u.userId === user.uid));
          
        const hasAccess = isUserOnActiveShift(todaysShifts);
        if (isMounted) setCanAccess(hasAccess);

      } catch (error) {
        console.error("Error checking user shift:", error);
        if (isMounted) setCanAccess(false); // Default to no access on error
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkShift();

    return () => {
      isMounted = false;
    };

  }, [isAuthLoading, user, weekId]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang kiểm tra ca làm việc...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <AlertDialog open={true} onOpenChange={() => {}}>
        <AlertDialogContent onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Không có ca làm việc</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn không có ca làm việc nào được phân công vào thời điểm này. Bạn không thể truy cập chức năng này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.replace(redirectPath)}>Đã hiểu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return <>{children}</>;
}
