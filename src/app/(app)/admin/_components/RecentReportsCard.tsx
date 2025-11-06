'use client';

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { FileText, ArrowRight } from 'lucide-react';
import type { ShiftReport } from '@/lib/types';
import { ListCard } from './ListCard';
import { Button } from '@/components/ui/button';

type RecentReportsCardProps = {
  shiftReports: ShiftReport[];
};

export function RecentReportsCard({ shiftReports }: RecentReportsCardProps) {
  return (
    <ListCard title="Báo cáo mới nhất" icon={<FileText className="text-orange-500" />} link="/reports" linkText="Xem tất cả Báo cáo">
      {shiftReports.length > 0 ? shiftReports.slice(0, 4).map(report => (
        <div key={report.id} className="flex items-center justify-between text-sm p-2 rounded-md border bg-muted/50">
          <div>
            <p className="font-semibold">{report.staffName}</p>
            <p className="text-muted-foreground">Đã nộp báo cáo ca {report.shiftKey} lúc {format(new Date(report.submittedAt as string), 'HH:mm')}</p>
          </div>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href={`/reports/by-shift?date=${report.date}&shiftKey=${report.shiftKey}`}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )) : <p className="text-sm text-muted-foreground text-center py-4">Chưa có báo cáo nào hôm nay.</p>}
    </ListCard>
  );
}