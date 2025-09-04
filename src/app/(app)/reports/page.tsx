
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CheckCircle, Users } from 'lucide-react';
import type { ShiftReport, TasksByShift, InventoryReport } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';

type ReportType = ShiftReport | InventoryReport;

type GroupedReports = {
  [date: string]: {
    [key: string]: ReportType[]; // key can be shiftKey or report type like 'inventory'
  };
};

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<ReportType[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/shifts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'Chủ nhà hàng') return;

    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      setTasksByShift(tasks);
    });

    const unsubscribeReports = dataStore.subscribeToReports((allReports) => {
       setReports(allReports);
       setIsLoading(false);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeReports();
    };
  }, [user]);

  const getReportKey = (report: ReportType): string => {
    if ('shiftKey' in report) {
      return report.shiftKey;
    }
    // Simple way to identify inventory reports
    if ('stockLevels' in report) {
      return 'inventory';
    }
    return 'unknown';
  }

  const getReportLink = (date: string, key: string): string => {
    if (tasksByShift?.[key]) { // Checklist reports
        return `/reports/by-shift?date=${date}&shiftKey=${key}`;
    }
    switch (key) {
        case 'bartender_hygiene':
            return `/reports/hygiene?date=${date}`;
        case 'inventory':
            return `/reports/inventory?date=${date}`;
        // Add this case in a future update when the report view is created
        // case 'manager_comprehensive':
        //     return `/reports/comprehensive?date=${date}`;
        default:
             return '#';
    }
  }
  
  const getReportName = (key: string): string => {
    if (tasksByShift && tasksByShift[key]) {
      return `Checklist ${tasksByShift[key].name}`;
    }
    switch (key) {
      case 'bartender_hygiene':
        return 'Báo cáo Vệ sinh quầy';
      case 'inventory':
        return 'Báo cáo Kiểm kê Tồn kho';
      case 'manager_comprehensive':
        return 'Phiếu kiểm tra toàn diện';
      default:
        return `Báo cáo không xác định: ${key}`;
    }
  };


  const groupedReports: GroupedReports = useMemo(() => {
    return reports.reduce((acc, report) => {
      const date = report.date;
      const key = getReportKey(report);
      
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][key]) {
        acc[date][key] = [];
      }
      acc[date][key].push(report);
      return acc;
    }, {} as GroupedReports);
  }, [reports]);

  const sortedDates = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  if(isLoading || authLoading || user?.role !== 'Chủ nhà hàng') {
      return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-2" />
            </header>
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-1/4 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
      )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Báo cáo đã nộp</h1>
        <p className="text-muted-foreground">Xem lại các báo cáo đã được gửi từ tất cả nhân viên, được nhóm theo ngày và ca.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo gần đây</CardTitle>
          <CardDescription>
            Hiển thị {reports.length} báo cáo đã nộp gần nhất, được nhóm theo ngày và ca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDates.length > 0 ? (
            <Accordion type="multiple" defaultValue={sortedDates.slice(0,1)}>
              {sortedDates.map((date) => (
                <AccordionItem value={date} key={date}>
                  <AccordionTrigger className="text-lg font-medium">
                    Ngày {new Date(date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên báo cáo</TableHead>
                          <TableHead>Nhân viên đã nộp</TableHead>
                          <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(groupedReports[date]).map(([key, reportGroup]) => {
                          const reportName = getReportName(key);
                          const staffNames = [...new Set(reportGroup.map(r => r.staffName))].join(', ');
                          
                          return (
                            <TableRow key={`${date}-${key}`}>
                              <TableCell className="font-semibold capitalize">{reportName}</TableCell>
                              <TableCell>
                                <p className="text-sm text-muted-foreground">{staffNames}</p>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={getReportLink(date, key)}>
                                    Xem chi tiết <ArrowRight className="ml-2 h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
             <div className="text-center text-muted-foreground py-8">
                <p>Không có báo cáo nào được nộp.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
