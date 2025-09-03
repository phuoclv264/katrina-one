
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
import type { ShiftReport, TasksByShift } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';

type GroupedReports = {
  [date: string]: {
    [shiftKey: string]: ShiftReport[];
  };
};

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [tasksByShift, setTasksByShift] = useState<TasksByShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Quản lý' && user?.role !== 'Chủ nhà hàng') {
      router.replace('/shifts');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng')) return;

    const unsubscribeTasks = dataStore.subscribeToTasks((tasks) => {
      setTasksByShift(tasks);
    });

    const unsubscribeReports = dataStore.subscribeToReports((reports) => {
      setReports(reports.filter(r => r.status === 'submitted')); // Only show submitted reports
      setIsLoading(false);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeReports();
    };
  }, [user]);

  const groupedReports: GroupedReports = useMemo(() => {
    return reports.reduce((acc, report) => {
      const date = report.date; // Use the report's date field
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][report.shiftKey]) {
        acc[date][report.shiftKey] = [];
      }
      acc[date][report.shiftKey].push(report);
      return acc;
    }, {} as GroupedReports);
  }, [reports]);

  const sortedDates = Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  if(isLoading || authLoading || (user?.role !== 'Quản lý' && user?.role !== 'Chủ nhà hàng')) {
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
        <p className="text-muted-foreground">Xem lại các báo cáo đã được gửi từ tất cả nhân viên, được nhóm theo ca.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo gần đây</CardTitle>
          <CardDescription>
            Hiển thị {reports.length} báo cáo đã nộp gần nhất, được nhóm theo ngày và ca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedDates.length > 0 && tasksByShift ? (
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
                          <TableHead>Ca làm việc</TableHead>
                          <TableHead>Nhân viên báo cáo</TableHead>
                          <TableHead className="text-center">Hoàn thành</TableHead>
                          <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(groupedReports[date]).map(([shiftKey, shiftReports]) => {
                          const shiftName = tasksByShift[shiftKey]?.name || shiftKey;
                          const totalTasksInShift = tasksByShift[shiftKey]?.sections.flatMap(s => s.tasks).length || 0;
                          
                          const totalCompletedTasks = shiftReports.reduce((sum, report) => {
                             const completed = Object.values(report.completedTasks).filter(c => Array.isArray(c) && c.length > 0).length;
                             return sum + completed;
                          }, 0);

                          const avgCompletion = shiftReports.length > 0 ? (totalCompletedTasks / (shiftReports.length * totalTasksInShift)) * 100 : 0;
                          
                          return (
                            <TableRow key={`${date}-${shiftKey}`}>
                              <TableCell className="font-semibold capitalize">{shiftName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="gap-1.5">
                                    <Users className="h-3 w-3" />
                                    {shiftReports.length} báo cáo
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={avgCompletion === 100 ? 'default' : 'outline'}>
                                    {Math.round(avgCompletion)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`/reports/by-shift?date=${date}&shiftKey=${shiftKey}`}>
                                    Xem chi tiết ca <ArrowRight className="ml-2 h-4 w-4" />
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
