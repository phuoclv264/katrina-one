'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset, ShieldX, CalendarDays, Loader2, Info, CheckSquare, ClipboardList, Archive, FileSearch, Banknote, Coffee, UserCog, ClockIcon, MessageSquare } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CheckInCard from '../_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';

const mainShiftInfo: { [key: string]: { name: string, icon: React.ElementType, href: string } } = {
    sang: { name: "Ca Sáng", icon: Sun, href: "/checklist/sang" },
    trua: { name: "Ca Trưa", icon: Sunset, href: "/checklist/trua" },
    toi: { name: "Ca Tối", icon: Moon, href: "/checklist/toi" },
};

export default function ShiftsPage() {
  const { user, loading: authLoading, activeShifts, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();

  useEffect(() => {
    if (!authLoading && user && (user.role !== 'Phục vụ' && !user.secondaryRoles?.includes('Phục vụ'))) {
      router.replace('/');
    }
  }, [user, authLoading, router]);
  
  const hasBartenderSecondaryRole = user?.secondaryRoles?.includes('Pha chế');
  const hasManagerSecondaryRole = user?.secondaryRoles?.includes('Quản lý');
  const hasCashierSecondaryRole = user?.secondaryRoles?.includes('Thu ngân');
  const isPrimaryServer = user?.role === 'Phục vụ';

  const activeMainShiftKeys = useMemo(() => {
    const keys = activeShifts.map(shift => {
        if (!shift.timeSlot || !shift.timeSlot.start) {
            return null;
        }
        const startTimeHour = parseInt(shift.timeSlot.start.split(':')[0], 10);

        if (startTimeHour < 12) {
            return 'sang';
        } else if (startTimeHour < 17) {
            return 'trua';
        } else {
            return 'toi';
        }
    });
    
    const uniqueKeys = [...new Set(keys)];

    return uniqueKeys.filter((key): key is "sang" | "trua" | "toi" => key !== null);
  }, [activeShifts]);

  if (authLoading) {
    return (
       <div className="flex min-h-full items-center justify-center p-4">
         <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Đang tải...</p>
         </div>
      </div>
    )
  }

  if (!user) {
    return null;
  }

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {showCheckInCardOnTop && <CheckInCard />}
        <Card>
          <CardHeader>
            <CardTitle>Checklist Công việc</CardTitle>
            <CardDescription>
              {todaysShifts.length > 0
                ? `Hôm nay bạn có ca: ${shiftsText}. Chọn ca để báo cáo.`
                : "Bạn không có ca làm việc nào hôm nay, liên hệ chủ quán để thay đổi lịch làm."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
              {isCheckedIn && activeMainShiftKeys.length > 0 ? (
                  activeMainShiftKeys.map((key) => {
                    const info = mainShiftInfo[key];
                    if (!info) return null;
                    const Icon = info.icon;
                    return (
                      <Button asChild size="lg" key={key}>
                        <Link href={info.href}>
                          <Icon className="mr-2" />
                          {info.name}
                        </Link>
                      </Button>
                    );
                  })
              ) : (
                  <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 dark:text-amber-300">Không trong ca làm việc</AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-400">
                      {(!isCheckedIn && activeMainShiftKeys.length > 0) ? 
                      `Chấm công vào để thực hiện báo cáo công việc.` :
                      `Vui lòng kiểm tra lịch và quay lại khi đến giờ làm việc của bạn.`
                    }
                    </AlertDescription>
                  </Alert>
              )}

            {isPrimaryServer && (
              <>
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
              </>
            )}

            {isCheckedIn && (hasBartenderSecondaryRole || hasManagerSecondaryRole || hasCashierSecondaryRole) && <Separator className="my-2" />}

            {isCheckedIn && hasBartenderSecondaryRole && (
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
