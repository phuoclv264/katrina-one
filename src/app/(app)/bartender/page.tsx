
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, FileSearch, Banknote, Loader2, Info, ClockIcon, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CheckInCard from '../_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TaskReportingCard from '../monthly-tasks/_components/task-reporting-card';
import type { MonthlyTaskAssignment } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format } from 'date-fns';

export default function BartenderDashboardPage() {
  const { user, loading, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);

  useEffect(() => {
    if (!loading && user && (user.role !== 'Pha chế' && !user.secondaryRoles?.includes('Pha chế'))) {
      router.replace('/');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    if (user) {
      const today = new Date();
      const unsub = dataStore.subscribeToUserMonthlyAssignments(user.uid, { from: today, to: today }, setTodaysMonthlyAssignments);
      return () => unsub();
    }
  }, [user]);

  if (loading || !user) {
    return (
       <div className="flex min-h-full items-center justify-center">
         <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Đang tải...</p>
         </div>
      </div>
    )
  }
  
  const hasServerSecondaryRole = user.secondaryRoles?.includes('Phục vụ');
  const hasManagerSecondaryRole = user.secondaryRoles?.includes('Quản lý');
  const hasCashierSecondaryRole = user.secondaryRoles?.includes('Thu ngân');

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {showCheckInCardOnTop && <CheckInCard />}

        {isCheckedIn && todaysMonthlyAssignments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-center text-primary">Công việc định kỳ hôm nay</h2>
            {todaysMonthlyAssignments.map(assignment => (
              <TaskReportingCard key={`${assignment.taskId}-${assignment.assignedDate}`} assignment={assignment} />
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Danh mục Báo cáo Pha chế</CardTitle>
            <CardDescription>
              {todaysShifts.length > 0
                ? `Hôm nay bạn có ca: ${shiftsText}. Chọn báo cáo để thực hiện.`
                : "Bạn không có ca làm việc nào hôm nay."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isCheckedIn ? (
              <>
                <Button asChild size="lg">
                  <Link href="/bartender/hygiene-report">
                    <ClipboardList className="mr-2" />
                    Báo cáo Vệ sinh quầy
                  </Link>
                </Button>
                <Button asChild size="lg">
                  <Link href="/bartender/inventory">
                    <Archive className="mr-2" />
                    Kiểm kê Tồn kho
                  </Link>
                </Button>
              </>
            ) : (
               <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">Chưa chấm công</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  Vui lòng chấm công để bắt đầu thực hiện báo cáo.
                </AlertDescription>
              </Alert>
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
            <Button asChild size="lg" variant="outline">
              <Link href="/reports-feed">
                  <MessageSquare className="mr-2" />
                  Tố cáo
              </Link>
            </Button>
            
            {isCheckedIn && (hasServerSecondaryRole || hasManagerSecondaryRole || hasCashierSecondaryRole) && <Separator className="my-2" />}

            {isCheckedIn && hasServerSecondaryRole && (
              <>
                <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Phục vụ</p>
                <Button asChild size="lg" variant="outline">
                  <Link href="/shifts">
                    <CheckSquare className="mr-2" />
                    Checklist Công việc
                  </Link>
                </Button>
              </>
            )}

            {isCheckedIn && hasManagerSecondaryRole && (
              <>
                <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Quản lý</p>
                 <Button asChild size="lg" variant="outline">
                  <Link href="/manager/comprehensive-report">
                    <FileSearch className="mr-2" />
                    Phiếu kiểm tra toàn diện
                  </Link>
                </Button>
              </>
            )}

            {isCheckedIn && hasCashierSecondaryRole && (
              <>
                <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Thu ngân</p>
                 <Button asChild size="lg" variant="outline">
                  <Link href="/cashier">
                    <Banknote className="mr-2" />
                    Báo cáo Thu ngân
                  </Link>
                </Button>
              </>
            )}

          </CardContent>
        </Card>
        {!showCheckInCardOnTop && <CheckInCard />}
      </div>
    </div>
  );
}
