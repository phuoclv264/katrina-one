
'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RevenueStats } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Loader2, Wand2 } from 'lucide-react';
import Link from 'next/link';
import RevenueStatsDialog from '@/app/(app)/cashier/_components/revenue-stats-dialog';

function CashierReportDetailsView() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const [report, setReport] = useState<RevenueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (reportId) {
      const unsub = dataStore.subscribeToRevenueStats(reportId, (data) => {
        setReport(data);
        setIsLoading(false);
      });
      return () => unsub();
    } else {
      setIsLoading(false);
    }
  }, [reportId]);
  
  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
    if(!user || !reportId) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited, reportId);
        toast.success("Đã cập nhật doanh thu.");
        setIsDialogOpen(false);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast.error("Không thể lưu doanh thu.");
    } finally {
        setIsProcessing(false);
    }
  }, [user, reportId]);

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto max-w-xl p-4 sm:p-6 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto max-w-xl p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold">Không tìm thấy báo cáo</h1>
        <p className="text-muted-foreground">Báo cáo bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
        <Button asChild variant="link" className="mt-4 -ml-4">
          <Link href="/reports/cashier">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto max-w-xl p-4 sm:p-6 md:p-8">
         <header className="mb-8">
            <Button asChild variant="ghost" className="-ml-4 mb-4">
              <Link href="/reports/cashier">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại
              </Link>
            </Button>
            <Button className="w-full" onClick={() => setIsDialogOpen(true)}>
                <Wand2 className="mr-2 h-4 w-4" />
                Chỉnh sửa hoặc Quét lại bằng AI
            </Button>
        </header>
      </div>
      <RevenueStatsDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSave={handleSaveRevenue}
          isProcessing={isProcessing}
          existingStats={report}
      />
    </>
  );
}

export default function CashierReportDetailsPage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <CashierReportDetailsView />
        </Suspense>
    )
}
