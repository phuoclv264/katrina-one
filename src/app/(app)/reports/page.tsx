
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import type { ShiftReport, TasksByShift, CompletionRecord } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsPage() {
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      setTasksByShift(tasks);
    });

    const unsubscribeReports = dataStore.subscribeToReports((reports) => {
      setReports(reports);
      setIsLoading(false);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeReports();
    };
  }, []);

  const groupedReports = useMemo(() => {
    return reports.reduce((acc, report) => {
      const date = new Date(report.submittedAt).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(report);
      return acc;
    }, {} as Record<string, ShiftReport[]>);
  }, [reports]);


  const getCompletedTaskCount = (report: ShiftReport) => {
    if (!tasksByShift) return 0;
    const allTasks = tasksByShift[report.shiftKey]?.sections.flatMap(s => s.tasks) || [];
    let completedCount = 0;
    
    allTasks.forEach(task => {
        const completions = report.completedTasks[task.id];
        if (Array.isArray(completions) && completions.length > 0) {
            completedCount++;
        }
    });
    
    return completedCount;
  };
  
  const getTotalTaskCount = (report: ShiftReport) => {
      if (!tasksByShift) return 0;
      return tasksByShift[report.shiftKey]?.sections.flatMap(s => s.tasks).length || 0;
  }


  const sortedDates = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  if(isLoading) {
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
        <h1 className="text-3xl font-bold font-headline">Báo cáo ca</h1>
        <p className="text-muted-foreground">Xem lại các báo cáo đã gửi từ tất cả nhân viên.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo gần đây</CardTitle>
          <CardDescription>
            Hiển thị {reports.length} báo cáo ca gần nhất, được nhóm theo ngày.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDates.length > 0 && tasksByShift ? (
            <Accordion type="multiple" defaultValue={sortedDates.slice(0,1)}>
              {sortedDates.map((date) => (
                <AccordionItem value={date} key={date}>
                  <AccordionTrigger className="text-lg font-medium">
                    Ngày {new Date(date).toLocaleDateString('vi-VN')}
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nhân viên</TableHead>
                          <TableHead>Ca làm việc</TableHead>
                          <TableHead>Thời gian gửi</TableHead>
                          <TableHead className="text-center">Hoàn thành nhiệm vụ</TableHead>
                          <TableHead className="text-center">Hình ảnh</TableHead>
                          <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedReports[date].map((report) => {
                          const allTasksCount = getTotalTaskCount(report);
                          const completedTasksCount = getCompletedTaskCount(report);
                          const shiftName = tasksByShift[report.shiftKey]?.name || report.shiftKey;
                          
                          return (
                            <TableRow key={report.id}>
                              <TableCell>{report.staffName}</TableCell>
                              <TableCell className="capitalize">{shiftName}</TableCell>
                               <TableCell>
                                {new Date(report.submittedAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={completedTasksCount === allTasksCount && allTasksCount > 0 ? 'default' : 'secondary'} className="gap-1">
                                    {completedTasksCount === allTasksCount && allTasksCount > 0 ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    <span>{completedTasksCount}/{allTasksCount}</span>
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                  <Badge variant="outline">{report.uploadedPhotos.length} đã tải lên</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`/reports/${report.id}`}>
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
                <p>Không có báo cáo nào để hiển thị.</p>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
