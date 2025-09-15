
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset, ShieldX, CalendarDays } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ShiftsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== 'Phục vụ') {
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
          <CardTitle>Chọn một ca làm việc</CardTitle>
          <CardDescription>Chọn ca làm việc hiện tại của bạn để xem danh sách công việc.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button asChild size="lg">
            <Link href="/checklist/sang">
              <Sun className="mr-2" />
              Ca Sáng
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/checklist/trua">
              <Sunset className="mr-2" />
              Ca Trưa
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/checklist/toi">
              <Moon className="mr-2" />
              Ca Tối
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
    </div>
  );
}
