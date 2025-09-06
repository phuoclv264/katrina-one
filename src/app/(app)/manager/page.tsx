
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, ClipboardList, Archive, ShieldX } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';

export default function ManagerDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng'))) {
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
            <Link href="/manager/hygiene-report">
              <ClipboardList className="mr-2" />
              Xem Báo cáo Vệ sinh
            </Link>
          </Button>
           <Button asChild size="lg" variant="outline">
            <Link href="/manager/inventory-report">
              <Archive className="mr-2" />
              Xem Báo cáo Tồn kho
            </Link>
          </Button>
          <Separator className="my-2" />
           <Button asChild size="lg" variant="destructive">
            <Link href="/violations">
                <ShieldX className="mr-2" />
                Ghi nhận Vi phạm
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
