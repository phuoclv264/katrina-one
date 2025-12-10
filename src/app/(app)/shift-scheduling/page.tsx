
'use client';

import React, { useEffect, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { LoadingPage } from '@/components/loading/LoadingPage';
import ScheduleView from './_components/schedule-view';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ShiftSchedulingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const canManage = user?.role === 'Chủ nhà hàng';

    useEffect(() => {
        if (!authLoading && !canManage) {
            router.replace('/');
        }
    }, [authLoading, canManage, router]);


    if (authLoading || !canManage) {
        return <LoadingPage />;
    }
    
    return (
        <div className="container mx-auto max-w-none p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Button variant="ghost" className="-ml-4 mb-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Button>
                <div>
                  <h1 className="text-3xl font-bold font-headline">Xếp lịch & Phê duyệt</h1>
                  <p className="text-muted-foreground mt-2">
                      Tạo lịch làm việc, phân công nhân viên, đề xuất và công bố lịch chính thức.
                  </p>
                </div>
            </header>
            <Suspense fallback={<LoadingPage />}>
              <ScheduleView />
            </Suspense>
        </div>
    );
}
