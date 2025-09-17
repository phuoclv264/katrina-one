
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Archive, ShieldX, CalendarDays, Sun, Moon, Sunset } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';

function ServerDashboard() {
  return (
    <Card className="mt-8">
        <CardHeader>
          <CardTitle>Bảng điều khiển Phục vụ (Phụ)</CardTitle>
          <CardDescription>Truy cập các tính năng của vai trò phụ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button asChild size="lg" variant="outline">
            <Link href="/shifts">
              <Sun className="mr-2" />
              Checklist Công việc
            </Link>
          </Button>
        </CardContent>
      </Card>
  )
}

export default function BartenderDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== 'Pha chế') {
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

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Danh mục Báo cáo Pha chế</CardTitle>
            <CardDescription>Chọn loại báo cáo bạn muốn thực hiện hôm nay.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
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

        {hasServerSecondaryRole && <ServerDashboard />}
      </div>
    </div>
  );
}
