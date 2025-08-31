
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import type { ShiftReport, TasksByShift } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function ReportsPage() {
  const [reports, setReports] = useState(dataStore.getReports());
  const [tasksByShift, setTasksByShift] = useState(dataStore.getTasks());

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setReports(dataStore.getReports());
      setTasksByShift(dataStore.getTasks());
    });
    return () => unsubscribe();
  }, []);

  const groupedReports = useMemo(() => {
    return reports.reduce((acc, report) => {
      const date = report.shiftDate;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(report);
      return acc;
    }, {} as Record<string, ShiftReport[]>);
  }, [reports]);

  function getCompletionStatus(report: ShiftReport) {
      const shiftTasks = tasksByShift[report.shiftKey]?.sections.flatMap(s => s.tasks) || [];
      const criticalTasks = shiftTasks.filter(t => t.isCritical);

      if (criticalTasks.length === 0) {
          return { text: "Hoàn thành", variant: "default", icon: CheckCircle };
      }

      const completedCriticalCount = criticalTasks.filter(task => {
          const completionStatus = report.completedTasks[task.id];
          if (typeof completionStatus === 'boolean') {
              return completionStatus;
          }
          if (typeof completionStatus === 'object' && completionStatus !== null && !Array.isArray(completionStatus)) {
              return Object.values(completionStatus).every(Boolean);
          }
          return false;
      }).length;
      
      if (completedCriticalCount === criticalTasks.length) {
          return { text: "Hoàn thành", variant: "default", icon: CheckCircle };
      }
      
      if (completedCriticalCount > 0) {
          return { text: "Hoàn thành một phần", variant: "secondary", icon: CheckCircle };
      }

      return { text: "Chưa hoàn thành", variant: "destructive", icon: XCircle };
  }

  const getCompletedTaskCount = (report: ShiftReport) => {
    const allTasks = tasksByShift[report.shiftKey]?.sections.flatMap(s => s.tasks) || [];
    let completedCount = 0;
    
    allTasks.forEach(task => {
        const status = report.completedTasks[task.id];
        if (task.timeSlots) {
            if (Array.isArray(status) && status.length > 0) {
                completedCount++;
            }
        } else {
            if (typeof status === 'boolean' && status) {
                completedCount++;
            }
        }
    });
    
    return completedCount;
  };
  
  const getTotalTaskCount = (report: ShiftReport) => {
      return tasksByShift[report.shiftKey]?.sections.flatMap(s => s.tasks).length || 0;
  }


  const sortedDates = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());


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
          {sortedDates.length > 0 ? (
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
                          const status = getCompletionStatus(report);
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
                                <Badge variant={completedTasksCount === allTasksCount ? 'default' : 'secondary'} className="gap-1">
                                    {completedTasksCount === allTasksCount ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
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
