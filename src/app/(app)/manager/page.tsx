
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, Banknote, Loader2, Info, UserCog, ClockIcon, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ManagerDashboardPage() {
  const { user, loading, isOnActiveShift, todaysShifts } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
      router.replace('/');
    }
  }, [user, loading, router]);

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
  const hasBartenderSecondaryRole = user.secondaryRoles?.includes('Pha chế');
  const hasCashierSecondaryRole = user.secondaryRoles?.includes('Thu ngân');

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
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
            {isOnActiveShift ? (
              <Button asChild size="lg">
                <Link href="/manager/comprehensive-report">
                  <FileSearch className="mr-2" />
                  Phiếu kiểm tra toàn diện
                </Link>
              </Button>
            ) : (
              <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">Không trong ca làm việc</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  Chức năng kiểm tra toàn diện chỉ khả dụng khi bạn đang trong ca làm việc.
                </AlertDescription>
              </Alert>
            )}

            <Button asChild size="lg" variant="outline">
              <Link href="/reports">
                <CheckSquare className="mr-2" />
                Xem Báo cáo
              </Link>
            </Button>
            <Separator className="my-2" />
            <Button asChild size="lg" variant="outline">
              <Link href="/schedule">
                  <CalendarDays className="mr-2" />
                  Lịch làm việc
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/shift-scheduling">
                  <CalendarDays className="mr-2" />
                  Xếp lịch
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/violations">
                  <ShieldX className="mr-2" />
                  Ghi nhận Vi phạm
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/reports-feed">
                  <MessageSquare className="mr-2" />
                  Tố cáo
              </Link>
            </Button>

              {isOnActiveShift && (hasServerSecondaryRole || hasBartenderSecondaryRole || hasCashierSecondaryRole) && <Separator className="my-2" />}

              {isOnActiveShift && hasServerSecondaryRole && (
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

              {isOnActiveShift && hasBartenderSecondaryRole && (
                  <>
                  <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Pha chế</p>
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
                  </>
              )}
              
              {isOnActiveShift && hasCashierSecondaryRole && (
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
      </div>
    </div>
  );
}
