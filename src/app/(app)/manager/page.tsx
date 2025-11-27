'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, Banknote, Loader2, Info, UserCog, ClockIcon, MessageSquare, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CheckInCard from '../_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TaskReportingCard from '../monthly-tasks/_components/task-reporting-card';
import type { MonthlyTaskAssignment, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { LoadingPage } from '@/components/loading/LoadingPage';

export default function ManagerDashboardPage() {
  const { user, loading, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  useEffect(() => {
    if (!loading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleReconnect = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (user) {
      const unsubTasks = dataStore.subscribeToMonthlyTasksForDate(new Date(), setTodaysMonthlyAssignments);
      const unsubTemplates = dataStore.subscribeToShiftTemplates(setShiftTemplates);
      return () => {
        unsubTasks();
        unsubTemplates();
      };
    }
  }, [user, refreshTrigger]);

  useDataRefresher(handleReconnect);

  if (loading || !user) {
    return <LoadingPage />;
  }

  const hasServerSecondaryRole = user.secondaryRoles?.includes('Phục vụ');
  const hasBartenderSecondaryRole = user.secondaryRoles?.includes('Pha chế');
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
              <TaskReportingCard key={`${assignment.taskId}-${assignment.assignedDate}`} assignment={assignment} shiftTemplates={shiftTemplates} />
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCog /> Bảng điều khiển Quản lý</CardTitle>
            <CardDescription>
              {todaysShifts.length > 0
                ? `Hôm nay bạn có ca: ${shiftsText}. Chọn chức năng để thực hiện.`
                : "Bạn không có ca làm việc nào hôm nay."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isCheckedIn ? (
              <Button size="lg" onClick={() => router.push('/manager/comprehensive-report')}>
                <FileSearch className="mr-2" />
                Phiếu kiểm tra toàn diện
              </Button>
            ) : (
              <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">Chưa chấm công</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  Vui lòng chấm công để truy cập các chức năng quản lý.
                </AlertDescription>
              </Alert>
            )}

            <Button size="lg" variant="outline" onClick={() => router.push('/reports')}>
              <CheckSquare className="mr-2" />
              Xem Báo cáo
            </Button>
            <Separator className="my-2" />
            <Button size="lg" variant="outline" onClick={() => router.push('/schedule')}>
              <CalendarDays className="mr-2" />
              Lịch làm việc
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/shift-scheduling')}>
              <CalendarDays className="mr-2" />
              Xếp lịch
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/violations')}>
              <ShieldX className="mr-2" />
              Ghi nhận Vi phạm
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/reports-feed')}>
              <MessageSquare className="mr-2" />
              Tố cáo
            </Button>

              {isCheckedIn && (hasServerSecondaryRole || hasBartenderSecondaryRole || hasCashierSecondaryRole) && <Separator className="my-2" />}

              {isCheckedIn && hasServerSecondaryRole && (
                <>
                  <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Phục vụ</p>
                  <Button size="lg" variant="outline" onClick={() => router.push('/shifts')}>
                    <CheckSquare className="mr-2" />
                    Checklist Công việc
                  </Button>
                </>
              )}

              {isCheckedIn && hasBartenderSecondaryRole && (
                  <>
                  <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Pha chế</p>
                  <Button size="lg" variant="outline" onClick={() => router.push('/bartender/hygiene-report')}>
                      <ClipboardList className="mr-2" />
                      Báo cáo Vệ sinh quầy
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => router.push('/bartender/inventory')}>
                      <Archive className="mr-2" />
                      Kiểm kê Tồn kho
                  </Button>
                  </>
              )}
              
              {isCheckedIn && hasCashierSecondaryRole && (
                <>
                  <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Thu ngân</p>
                  <Button size="lg" variant="outline" onClick={() => router.push('/cashier')}>
                    <Banknote className="mr-2" />
                    Báo cáo Thu ngân
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
