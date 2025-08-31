'use client';

import { useRouter } from 'next/navigation';
import { Building, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';

export default function LoginPage() {
  const { login, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role === 'staff') {
      router.replace('/shifts');
    } else if (role === 'manager') {
      router.replace('/reports');
    }
  }, [role, router]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-2 text-center mb-8">
        <h1 className="text-4xl font-bold text-primary font-headline">ShiftCheck</h1>
        <p className="text-muted-foreground max-w-sm">
          Cách đơn giản và hiệu quả để quản lý công việc và báo cáo hàng ngày.
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Chào mừng</CardTitle>
          <CardDescription>Vui lòng chọn vai trò của bạn để tiếp tục.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button size="lg" onClick={() => login('staff')}>
            <User className="mr-2 h-5 w-5" />
            Đăng nhập với tư cách Nhân viên
          </Button>
          <Button size="lg" variant="secondary" onClick={() => login('manager')}>
            <Building className="mr-2 h-5 w-5" />
            Đăng nhập với tư cách Quản lý
          </Button>
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 text-xs text-muted-foreground">
        Xây dựng với Firebase và Genkit
      </footer>
    </main>
  );
}
