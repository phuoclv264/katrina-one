
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowRight, Upload, Receipt, AlertTriangle, FileBox, Banknote } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function CashierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && user.role !== 'Thu ngân' && !user.secondaryRoles?.includes('Thu ngân')) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
        </header>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
        </div>
        <div className="mt-6">
            <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8">
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                <Banknote />
                Bảng điều khiển Thu ngân
            </h1>
            <p className="text-muted-foreground mt-2">
                Quản lý chi tiêu, bàn giao và các báo cáo tài chính trong ngày.
            </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {/* Summary Cards */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng chi tiền mặt</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">0đ</div>
                    <p className="text-xs text-muted-foreground">trong hôm nay</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tổng chi chuyển khoản</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">0đ</div>
                    <p className="text-xs text-muted-foreground">trong hôm nay</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Doanh thu (POS)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">0đ</div>
                    <p className="text-xs text-muted-foreground">Chưa nhập liệu</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tiền mặt thực tế</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Chưa khớp</div>
                     <p className="text-xs text-muted-foreground">Cần thực hiện bàn giao</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Quản lý Phiếu chi</CardTitle>
                            <Button size="sm">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Tạo phiếu chi
                            </Button>
                        </div>
                        <CardDescription>Lịch sử các khoản chi trong ngày. Dữ liệu sẽ được làm mới vào ngày hôm sau.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-sm text-muted-foreground py-8">Chưa có phiếu chi nào trong hôm nay.</p>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Báo cáo Sự cố</CardTitle>
                        <CardDescription>Ghi nhận các sự cố làm hư hỏng, thất thoát tài sản hoặc nguyên vật liệu.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="w-full">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Tạo Báo cáo Sự cố
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Thống kê Doanh thu</CardTitle>
                        <CardDescription>Nhập số liệu từ bill tổng kết trên máy POS.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button variant="outline" className="w-full">
                            <Receipt className="mr-2 h-4 w-4" />
                            Nhập/Cập nhật Doanh thu
                        </Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Phiếu bàn giao cuối ngày</CardTitle>
                        <CardDescription>Đối soát và bàn giao tiền mặt cuối ngày.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button className="w-full">
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Thực hiện bàn giao
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
