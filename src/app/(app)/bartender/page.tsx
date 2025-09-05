
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Archive } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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

  return (
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bảng điều khiển Pha chế</CardTitle>
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
        </CardContent>
      </Card>
    </div>
  );
}
