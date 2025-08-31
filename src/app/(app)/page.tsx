'use client';

import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppRootPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role) {
      if (role === 'staff') {
        router.replace('/checklist');
      } else if (role === 'manager') {
        router.replace('/reports');
      }
    }
  }, [isLoading, role, router]);

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
