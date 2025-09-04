
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, FileText, ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
           <Button asChild size="lg" variant="secondary">
            <Link href="/reports">
              <FileText className="mr-2" />
              Xem báo cáo nhân viên
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/task-lists">
              <ClipboardList className="mr-2" />
              Quản lý danh sách công việc
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
