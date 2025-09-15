

'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import ScheduleView from './_components/schedule-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ShiftSchedulingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const canManage = user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng';

    useEffect(() => {
        if (!authLoading && !canManage) {
            router.replace('/');
        }
    }, [authLoading, canManage, router]);


    if (authLoading || !canManage) {
        return (
            <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    return (
        <div className="container mx-auto max-w-none p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Button asChild variant="ghost" className="-ml-4 mb-4">
                    <Link href="/manager">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Quay lại
                    </Link>
                </Button>
                 <h1 className="text-3xl font-bold font-headline">Xếp lịch & Phê duyệt</h1>
                <p className="text-muted-foreground mt-2">
                    Tạo lịch làm việc, phân công nhân viên, đề xuất và công bố lịch chính thức.
                </p>
            </header>
            <ScheduleView />
        </div>
    );
}
