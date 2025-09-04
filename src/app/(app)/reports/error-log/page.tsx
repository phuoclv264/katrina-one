
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, ArrowLeft, Bug } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Placeholder data - in a real app, this would come from a logging service
const placeholderErrors = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    message: 'Firestore (11.9.0): Uncaught Error in snapshot listener: FirebaseError: [code=permission-denied]: Missing or insufficient permissions.',
    source: '/reports/by-shift',
    user: 'manager@example.com'
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    message: 'Failed to upload image to Firebase Storage. User may be offline.',
    source: '/checklist/sang',
    user: 'phuoc@example.com'
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    message: 'AI suggestion flow timed out after 30 seconds.',
    source: '/bartender/inventory',
    user: 'thaochef@example.com'
  },
];


export default function ErrorLogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'Chủ nhà hàng') {
        router.replace('/');
      } else {
        setIsLoading(false);
      }
    }
  }, [user, authLoading, router]);


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
            Đây là danh sách các lỗi được ghi nhận tự động. Chức năng đang trong giai đoạn thử nghiệm.
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
                {placeholderErrors.map((error) => (
                    <TableRow key={error.id}>
                        <TableCell className="text-sm text-muted-foreground">
                            {new Date(error.timestamp).toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-destructive">
                           <div className="flex items-start gap-2">
                             <Bug className="h-4 w-4 mt-0.5 shrink-0"/> 
                             <span>{error.message}</span>
                           </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{error.source}</TableCell>
                        <TableCell className="text-sm">{error.user}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
             {placeholderErrors.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <p>Chúc mừng! Không có lỗi nào được ghi nhận.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

    