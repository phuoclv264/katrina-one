

'use client';

import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppRootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'Phục vụ') {
        router.replace('/shifts');
      } else if (user.role === 'Pha chế') {
        router.replace('/bartender');
      } else if (user.role === 'Quản lý') {
        router.replace('/manager');
      } else if (user.role === 'Chủ nhà hàng') {
        router.replace('/admin');
      } else if (user.role === 'Thu ngân') {
        router.replace('/cashier');
      }
    }
  }, [loading, user, router]);

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-6 w-6 rounded-sm" />
            <Skeleton className="h-6 w-full rounded-md" />
          </div>
           <div className="flex items-center space-x-4">
            <Skeleton className="h-6 w-6 rounded-sm" />
            <Skeleton className="h-6 w-full rounded-md" />
          </div>
           <div className="flex items-center space-x-4">
            <Skeleton className="h-6 w-6 rounded-sm" />
            <Skeleton className="h-6 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
