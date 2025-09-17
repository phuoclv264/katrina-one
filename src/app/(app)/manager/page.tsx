

'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';

export default function ManagerDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
       <div className="flex min-h-full items-center justify-center">
         <p>Đang tải...</p>
      </div>
    )
  }

  const hasServerSecondaryRole = user.secondaryRoles?.includes('Phục vụ');
  const hasBartenderSecondaryRole = user.secondaryRoles?.includes('Pha chế');

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bảng điều khiển Quản lý</CardTitle>
          <CardDescription>Chọn chức năng bạn muốn thực hiện.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button asChild size="lg">
            <Link href="/manager/comprehensive-report">
              <FileSearch className="mr-2" />
              Phiếu kiểm tra toàn diện
            </Link>
          </Button>
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

            {(hasServerSecondaryRole || hasBartenderSecondaryRole) && <Separator className="my-2" />}

            {hasServerSecondaryRole && (
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

            {hasBartenderSecondaryRole && (
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

        </CardContent>
      </Card>
    </div>
  );
}
