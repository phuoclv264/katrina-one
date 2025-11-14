'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, ArrowRight, Banknote, CalendarCheck, History, Settings } from 'lucide-react';

export function ManagementLinksCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
            <Settings className="text-gray-500" />
            Báo cáo & Quản lý
        </CardTitle>
        <CardDescription>Truy cập các trang báo cáo và quản lý chi tiết.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button asChild variant="outline">
          <Link href="/monthly-task-reports"><CalendarCheck className="mr-2 h-4 w-4" /> Báo cáo Công việc Định kỳ</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reports/inventory"><Archive className="mr-2 h-4 w-4" /> Báo cáo Tồn kho</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/financial-report"><Banknote className="mr-2 h-4 w-4" /> Báo cáo Tài chính</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/inventory-history"><History className="mr-2 h-4 w-4" /> Lịch sử Tồn kho</Link>
        </Button>
      </CardContent>
    </Card>
  );
}