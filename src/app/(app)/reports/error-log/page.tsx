
'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthUser } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, ArrowLeft, Bug } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { dataStore } from '@/lib/data-store';
import type { AppError } from '@/lib/types';


function ErrorLogView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        const unsubscribe = dataStore.subscribeToErrorLog((errorLog) => {
          setErrors(errorLog);
          setIsLoading(false);
        });
        return () => unsubscribe();
      }
    }
  }, [user, authLoading, router]);

  const handleErrorLogging = (error: Error, info: { componentStack: string }) => {
    const newError: AppError = {
        message: error.message,
        source: 'React Error Boundary',
        stack: info.componentStack,
        userId: user?.uid,
        userEmail: user?.email || undefined
    };
    dataStore.logErrorToServer(newError);
  }


  if (isLoading || authLoading) {
      return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-2" />
            </header>
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
        </div>
      )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
       <header className="mb-8">
          <Button asChild variant="ghost" className="-ml-4 mb-4">
              <Link href="/reports">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại Báo cáo
              </Link>
          </Button>
          <div className="flex items-start justify-between">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <ShieldAlert className="text-destructive"/>
                    Nhật ký lỗi hệ thống
                </h1>
                <p className="text-muted-foreground mt-2">
                    Nơi ghi nhận các lỗi phát sinh trong quá trình vận hành phần mềm.
                </p>
            </div>
           </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lỗi gần đây</CardTitle>
          <CardDescription>
            Danh sách các lỗi được ghi nhận tự động từ tất cả người dùng.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[200px]">Thời gian</TableHead>
                    <TableHead>Nội dung lỗi</TableHead>
                    <TableHead>Nguồn</TableHead>
                    <TableHead>Người dùng</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {errors.map((error) => (
                    <TableRow key={error.id}>
                        <TableCell className="text-sm text-muted-foreground">
                            {new Date(error.timestamp as string).toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-destructive">
                           <div className="flex items-start gap-2">
                             <Bug className="h-4 w-4 mt-0.5 shrink-0"/> 
                             <span>{error.message}</span>
                           </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{error.source}</TableCell>
                        <TableCell className="text-sm">{error.userEmail || error.userId || 'N/A'}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
             {errors.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <p>Chúc mừng! Không có lỗi nào được ghi nhận.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ErrorLogPage() {
    return (
        <Suspense fallback={<Skeleton className="h-screen w-full"/>}>
            <ErrorLogView />
        </Suspense>
    )
}
